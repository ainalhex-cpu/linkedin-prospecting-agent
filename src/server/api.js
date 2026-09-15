import { loadProspects, upsertProspect } from '../store/prospectStore.js';
import { createProspect } from '../schema/prospect.js';
import { findDuplicate } from '../deduplication/index.js';
import { analyzeProspect, formatOutput } from '../analysis/index.js';
import { topProspects } from '../pipeline/index.js';
import { extractFromText } from '../extraction/index.js';

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
