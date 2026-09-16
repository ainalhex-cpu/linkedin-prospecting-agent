import { loadProspects, upsertProspect } from '../store/prospectStore.js';
import { createProspect } from '../schema/prospect.js';
import { findDuplicate } from '../deduplication/index.js';
import { analyzeProspect, formatOutput } from '../analysis/index.js';
import { topProspects } from '../pipeline/index.js';
import { extractFromText } from '../extraction/index.js';
import { analyzeSemantic } from '../semantic-analysis/index.js';
import { computeOpportunity } from '../opportunity/index.js';
import { computePriority } from '../priority/index.js';
import { computeActionV2, suggestComment, suggestMessage } from '../actions/index.js';
import { getDiscoverySource } from '../discovery/index.js';
import { buildBriefing } from '../briefing/index.js';

/**
 * Couche de service partagee entre la CLI et le serveur HTTP. Elle ne
 * contient aucune regle metier : elle enchaine les moteurs existants
 * (schema, deduplication, analysis, pipeline) et le stockage JSON.
 */

export function getUiConfig(config) {
  return {
    signals: config.signals,
    scoring: config.scoring,
    offers: config.offers,
    pipeline: config.pipeline,
    thresholds: config.thresholds,
    icp: config.icp
  };
}

export function listProspects(filePath) {
  return loadProspects(filePath);
}

export function getProspect(id, filePath) {
  const prospects = loadProspects(filePath);
  return prospects.find((p) => p.id === id) || null;
}

function mergeSignalsByCategory(base, overrides = {}) {
  const merged = { ...base };
  for (const category of Object.keys(overrides)) {
    merged[category] = { ...merged[category], ...overrides[category] };
  }
  return merged;
}

/**
 * Cree un prospect, ou met a jour la fiche existante si un doublon est
 * detecte (meme logique de deduplication que la CLI, section 13 du brief).
 */
export function addProspect(input, filePath) {
  const prospects = loadProspects(filePath);
  const candidate = createProspect(input);

  const { match, matchedOn } = findDuplicate(candidate, prospects);
  if (match) {
    const merged = {
      ...match,
      ...input,
      id: match.id,
      signals: mergeSignalsByCategory(match.signals, input.signals)
    };
    upsertProspect(merged, filePath);
    return { prospect: merged, isDuplicate: true, matchedOn };
  }

  upsertProspect(candidate, filePath);
  return { prospect: candidate, isDuplicate: false, matchedOn: null };
}

export function analyzeExisting(id, config, event, filePath) {
  const prospects = loadProspects(filePath);
  const prospect = prospects.find((p) => p.id === id);
  if (!prospect) return null;
  const updated = analyzeProspect(prospect, config, { event });
  upsertProspect(updated, filePath);
  return { prospect: updated, output: formatOutput(updated, config) };
}

/**
 * Point d'entree utilise par le formulaire "Nouveau prospect" de
 * l'interface : ajoute (ou met a jour si doublon) puis lance l'analyse en
 * une seule etape.
 */
export function addAndAnalyze(input, config, filePath) {
  const { prospect, isDuplicate, matchedOn } = addProspect(input, filePath);
  const event = input.event || (isDuplicate ? 'Mise a jour via interface' : 'Analyse initiale via interface');
  const result = analyzeExisting(prospect.id, config, event, filePath);
  return { ...result, isDuplicate, matchedOn };
}

export function topProspectsList(n, filePath) {
  const prospects = loadProspects(filePath);
  return topProspects(prospects, n);
}

/**
 * Traduit une preuve d'extraction en "impact" lisible sur la decision du
 * moteur EXISTANT (scoring.json pour fit/maturite/probleme/intention, texte
 * descriptif pour contexte/exclusion). Purement informatif pour le "Pourquoi
 * ?" de l'interface : ne recalcule rien, ne modifie aucun score.
 */
function describeEvidenceImpact(evidence, config) {
  const { category, key, applied } = evidence;

  if (category === 'exclusion') {
    return applied
      ? "Declenche l'exclusion du prospect (temperature IGNORE)."
      : 'Signal faible : non retenu automatiquement, a verifier manuellement.';
  }

  if (category === 'contexte') {
    return applied
      ? "Influence la detection d'une offre LIBERTE."
      : 'Signal faible : non retenu automatiquement (hypothese).';
  }

  const criterion = config.scoring.categories[category]?.criteria.find((c) => c.key === key);
  if (!criterion) return applied ? 'Signal retenu.' : 'Signal faible, non retenu automatiquement (hypothese).';

  const categoryLabel = config.scoring.categories[category].label;
  return applied
    ? `+${criterion.points} points ${categoryLabel}`
    : `0 point (hypothese, signal non retenu automatiquement pour le score ${categoryLabel})`;
}

/**
 * Point d'entree "Analyser un profil LinkedIn" : transforme un texte brut
 * colle par l'utilisateur en signaux (module d'extraction separe, voir
 * src/extraction/), puis reutilise EXACTEMENT le meme flux que le
 * formulaire manuel (addAndAnalyze -> qualification/scoring/temperature/
 * offre/action existants). Aucun second moteur de scoring n'est cree ici.
 */
export function analyzeRawText(input, config, filePath) {
  const texteBrut = input.texte_brut || '';
  const extraction = extractFromText({ text: texteBrut, pays: input.pays }, config);

  const prospectInput = {
    prenom: input.prenom,
    nom: input.nom,
    entreprise: input.entreprise,
    pays: input.pays,
    url_linkedin: input.url_linkedin,
    type_prospect: input.type_prospect || extraction.champs_deduits.type_prospect || undefined,
    activite: input.activite || extraction.champs_deduits.activite || undefined,
    offre: input.offre || extraction.champs_deduits.offre || undefined,
    audience: input.audience || extraction.champs_deduits.audience || undefined,
    faits_observes: extraction.faits_observes,
    hypotheses: extraction.hypotheses,
    sources: input.sources && input.sources.length ? input.sources : ["Texte colle par l'utilisateur (profil/posts LinkedIn)"],
    signals: extraction.signals
  };

  const result = addAndAnalyze(prospectInput, config, filePath);

  const evidencesWithImpact = extraction.evidences.map((e) => ({
    ...e,
    impact: describeEvidenceImpact(e, config)
  }));

  return {
    ...result,
    extraction: {
      evidences: evidencesWithImpact,
      niveau_confiance_extraction: extraction.niveau_confiance_extraction,
      texte_brut: texteBrut
    }
  };
}

// =====================================================================
// V2 : analyse semantique, opportunite, priorite, decouverte, briefing.
// Le moteur existant (qualification/scoring/temperature/offer_matching,
// appele via addAndAnalyze plus haut) reste la source de verite pour le
// score et la temperature : les fonctions ci-dessous n'ajoutent que des
// champs supplementaires (icp_assessment, priorite, action V2...) sans
// jamais recalculer ou remplacer le score /100.
// =====================================================================

/**
 * Adapte un candidat brut de decouverte (V2 "mock", deja au format attendu,
 * OU V3 "web" : nom complet, snippet, sources multiples) vers l'entree
 * attendue par analyzeProspectV2. N'invente rien : un champ absent reste
 * absent plutot que devine.
 */
function normalizeDiscoveryInput(raw, criteria = {}) {
  // Format V2 (mock) : deja au bon format (prenom/nom separes, texte_brut).
  if (raw.prenom !== undefined || raw.texte_brut !== undefined) {
    return raw;
  }

  // Format V3 (web) : `nom` est le nom complet extrait d'un resultat de
  // recherche ; on le decoupe en prenom/nom sur le premier espace.
  const fullName = (raw.nom || '').trim();
  const spaceIndex = fullName.indexOf(' ');
  const prenom = spaceIndex === -1 ? fullName : fullName.slice(0, spaceIndex);
  const nom = spaceIndex === -1 ? '' : fullName.slice(spaceIndex + 1);

  const sources = (raw.sources || []).map(
    (s) =>
      `Requete "${s.requete}" — ${s.url || 'source inconnue'} (${s.source || 'web'}, trouve le ${
        s.date_decouverte ? new Date(s.date_decouverte).toLocaleDateString('fr-FR') : 'date inconnue'
      })`
  );

  return {
    prenom,
    nom,
    entreprise: raw.entreprise || undefined,
    pays: raw.pays || criteria.country || criteria.market || undefined,
    url_linkedin: raw.url_linkedin || '',
    texte_brut: raw.snippet || raw.title || '',
    sources: sources.length ? sources : undefined,
    premiere_decouverte: raw.premiere_decouverte,
    derniere_decouverte: raw.derniere_decouverte
  };
}

function recordPriorityHistory(previousPriorite, previousHistory, priorite, timestamp, event) {
  const historique_priorite = [...(previousHistory || [])];
  if (previousPriorite !== priorite || historique_priorite.length === 0) {
    historique_priorite.push({
      date: timestamp,
      priorite,
      evenement: event || (historique_priorite.length === 0 ? 'Analyse initiale' : 'Changement de priorite')
    });
  }
  return historique_priorite;
}

/**
 * Point d'entree V2 : texte brut -> analyse semantique (statut, activite
 * propre, contexte, garde-fous) -> moteur existant (qualification/scoring/
 * temperature/offre/action, INCHANGE) -> opportunite/priorite/action V2.
 */
export function analyzeProspectV2(input, config, filePath) {
  const texteBrut = input.texte_brut || '';
  const semantic = analyzeSemantic({ text: texteBrut, pays: input.pays }, config);

  const prospectInput = {
    prenom: input.prenom,
    nom: input.nom,
    entreprise: input.entreprise,
    pays: input.pays,
    url_linkedin: input.url_linkedin,
    type_prospect: input.type_prospect || semantic.champs_deduits.type_prospect || undefined,
    activite: input.activite || semantic.champs_deduits.activite || undefined,
    offre: input.offre || semantic.champs_deduits.offre || undefined,
    audience: input.audience || semantic.champs_deduits.audience || undefined,
    faits_observes: semantic.facts,
    hypotheses: semantic.hypotheses,
    sources: input.sources && input.sources.length ? input.sources : ['Texte colle (V2 - analyse semantique)'],
    signals: semantic.v1_signals
  };

  const { prospect, isDuplicate, matchedOn } = addProspect(prospectInput, filePath);
  const event = input.event || (isDuplicate ? 'Mise a jour via workflow V2' : 'Analyse initiale via workflow V2');
  const analyzed = analyzeExisting(prospect.id, config, event, filePath);
  const v1Prospect = analyzed.prospect;

  const opportunity = computeOpportunity(semantic, config);
  const priorite = computePriority({
    icpQualification: semantic.icp_assessment.qualification,
    opportunityLevel: opportunity.opportunity_level,
    temperature: v1Prospect.temperature
  });
  const actionV2 = computeActionV2(
    {
      v1Action: v1Prospect.action_recommandee,
      icpQualification: semantic.icp_assessment.qualification,
      signalDate: input.date_publication || null
    },
    config
  );

  const now = new Date().toISOString();
  const historique_priorite = recordPriorityHistory(v1Prospect.priorite, v1Prospect.historique_priorite, priorite, now, event);

  const enriched = {
    ...v1Prospect,
    icp_assessment: semantic.icp_assessment,
    statut_professionnel: semantic.context.statut_professionnel,
    activite_propre: semantic.context.activite_propre,
    offre_commercialisee_v2: semantic.context.offre_commercialisee,
    signals_v2: semantic.signals,
    intention_level: opportunity.intention_level,
    opportunity_level: opportunity.opportunity_level,
    opportunity_reason: opportunity.reason,
    priorite,
    historique_priorite,
    action_recommandee_v2: actionV2.action,
    justification_action_v2: actionV2.reason,
    comment_suggere: suggestComment(v1Prospect),
    message_suggere: suggestMessage(v1Prospect, opportunity),
    derniere_analyse_v2: now,
    derniere_decouverte: input.derniere_decouverte || now
  };

  upsertProspect(enriched, filePath);

  return { prospect: enriched, isDuplicate, matchedOn, semantic, opportunity };
}

/**
 * Workflow section 16 (V2) / section 8+16 (V3) : DISCOVER -> DEDUPLICATE ->
 * ANALYZE -> QUALIFY -> SCORE -> OPPORTUNITY -> PRIORITIZE -> SAVE.
 *
 * `source` choisit la DiscoverySource ('mock' par defaut, retro-compatible
 * avec la V2 ; 'web' pour la decouverte par recherche, section 4-7 du brief
 * V3). Le reste du pipeline (analyse semantique, qualification/scoring/
 * temperature/offer_matching existants, opportunite, priorite) est
 * strictement identique quelle que soit la source.
 */
export function runProspectingWorkflow(
  { source = 'mock', country, market, type, profile_type, keywords, limit = 10 } = {},
  config,
  filePath
) {
  const resolvedType = profile_type || type;
  const discoverySource = getDiscoverySource(source, config);
  // `type` (V2, filtre exact sur le mock) et `profile_type` (V3, choisit les
  // templates de requetes web) sont deux vocabulaires different pour le
  // meme concept : on transmet les deux pour rester compatible avec
  // n'importe quelle DiscoverySource.
  const discoveryResult = discoverySource.discoverProspects({ country, market, type: resolvedType, profile_type: resolvedType, keywords, limit });
  const rawCandidates = discoveryResult.candidates;
  const discoveryStats = discoveryResult.stats || {};

  const stats = {
    source,
    requetes: discoveryStats.requetes || 0,
    resultats_bruts: discoveryStats.resultats_bruts ?? rawCandidates.length,
    doublons_recherche: discoveryStats.doublons || 0,
    hors_cible_decouverte: discoveryStats.hors_cible || 0,
    trouves: rawCandidates.length,
    nouveaux: 0,
    doublons: 0,
    analyses: 0,
    HOT: 0,
    WARM: 0,
    COLD: 0,
    IGNORE: 0,
    priorite: { A: 0, B: 0, C: 0, IGNORE: 0 }
  };
  const analyzed = [];

  for (const raw of rawCandidates) {
    const input = normalizeDiscoveryInput(raw, { country, market });
    const result = analyzeProspectV2(input, config, filePath);
    analyzed.push(result.prospect);
    stats.analyses += 1;
    if (result.isDuplicate) stats.doublons += 1;
    else stats.nouveaux += 1;
    const temp = result.prospect.temperature;
    if (stats[temp] !== undefined) stats[temp] += 1;
    const prio = result.prospect.priorite;
    if (prio && stats.priorite[prio] !== undefined) stats.priorite[prio] += 1;
  }

  const top = topProspects(loadProspects(filePath), limit);

  return { stats, prospects: analyzed, top, eliminated: discoveryResult.eliminated || [] };
}

/**
 * Section 13 : recupere, deduplique, analyse, qualifie et priorise, puis
 * retourne les meilleurs candidats operationnels. Ne remplit JAMAIS
 * artificiellement la liste : s'il n'y a que 4 prospects pertinents, elle
 * en retourne 4 (topProspects, reutilise, ne fait deja aucun padding).
 */
export function getDailyProspects(limit = 10, options = {}, config, filePath) {
  const result = runProspectingWorkflow({ ...options, limit }, config, filePath);
  return result.top.slice(0, limit);
}

export function getBriefingText(config, filePath) {
  const prospects = loadProspects(filePath);
  return buildBriefing(prospects, {});
}
