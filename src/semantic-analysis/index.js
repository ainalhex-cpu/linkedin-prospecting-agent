/**
 * Couche d'analyse semantique (V2). Elle ne fait NI scoring NI decision
 * finale : elle enrichit la couche d'extraction existante (V1.1,
 * src/extraction/) avec une comprehension de CONTEXTE que de simples
 * regex mot-a-mot ne peuvent pas capturer :
 *
 *  - statut professionnel (fondateur, dirigeant, independant, salarie...)
 *  - activite propre demontree ou non (jamais une simple ligne de poste)
 *  - etat de l'offre commerciale (CONFIRMEE / PROBABLE / NON_IDENTIFIEE)
 *  - contexte d'un signal ambigu ("je recrute" = salarie interne, freelance,
 *    prestataire, associe, ou indetermine)
 *  - garde-fou "probleme du prospect" vs "probleme de ses propres clients"
 *
 * Principe inchange : rien n'est invente. Une valeur non prouvee reste
 * explicitement 'NON_DEMONTREE' / 'NON_IDENTIFIEE' / 'non_determine' /
 * 'inconnu' / 'A_VERIFIER' plutot que d'etre devinee.
 *
 * Le moteur de scoring existant (src/scoring, src/qualification,
 * src/temperature, src/offer_matching) reste la source de verite : ce
 * module ne fait que preparer un jeu de signaux V1 plus juste avant de le
 * lui transmettre (voir toV1Signals ci-dessous), sans jamais modifier ses
 * regles ou ses seuils.
 */
import { extractFromText, splitSentences, normalizeForMatch, CONFIDENCE_PRIORITY } from '../extraction/index.js';

const INDEPENDANT_STATUTS = [
  'fondateur',
  'dirigeant',
  'coach_independant',
  'formateur_independant',
  'consultant_independant',
  'independant'
];
const SALARIE_STATUTS = ['salarie', 'responsable_operationnel_salarie'];
const STATUT_PRIORITY_ORDER = [
  'fondateur',
  'dirigeant',
  'coach_independant',
  'formateur_independant',
  'consultant_independant',
  'independant',
  'responsable_operationnel_salarie',
  'salarie'
];

function findBestMatch(rules, sentences, normalizedSentences) {
  let best = null;
  for (const rule of rules || []) {
    let regex;
    try {
      regex = new RegExp(rule.pattern, 'i');
    } catch {
      continue;
    }
    const index = normalizedSentences.findIndex((s) => regex.test(s));
    if (index === -1) continue;
    if (!best || CONFIDENCE_PRIORITY[rule.confidence] > CONFIDENCE_PRIORITY[best.confidence]) {
      best = { confidence: rule.confidence, evidence: sentences[index] };
    }
  }
  return best;
}

function detectStatutProfessionnel(sentences, normalizedSentences, statutConfig) {
  for (const statut of STATUT_PRIORITY_ORDER) {
    const match = findBestMatch(statutConfig.statut_professionnel[statut], sentences, normalizedSentences);
    if (match) return { statut, evidence: match.evidence, confidence: match.confidence };
  }
  return { statut: 'inconnu', evidence: null, confidence: null };
}

function detectActivitePropre(sentences, normalizedSentences, statutConfig) {
  const confirmed = findBestMatch(statutConfig.activite_propre.confirmee, sentences, normalizedSentences);
  if (confirmed) return { value: 'CONFIRMEE', evidence: confirmed.evidence, confidence: confirmed.confidence };
  const negative = findBestMatch(statutConfig.activite_propre.non_demontree_markers, sentences, normalizedSentences);
  return { value: 'NON_DEMONTREE', evidence: negative ? negative.evidence : null, confidence: negative ? negative.confidence : null };
}

function detectOffreTriState(sentences, normalizedSentences, statutConfig) {
  const confirmed = findBestMatch(statutConfig.offre_commercialisee_v2.confirmee, sentences, normalizedSentences);
  if (confirmed) return { value: 'CONFIRMEE', evidence: confirmed.evidence, confidence: confirmed.confidence };
  const probable = findBestMatch(statutConfig.offre_commercialisee_v2.probable, sentences, normalizedSentences);
  if (probable) return { value: 'PROBABLE', evidence: probable.evidence, confidence: probable.confidence };
  return { value: 'NON_IDENTIFIEE', evidence: null, confidence: null };
}

function detectProfilTypeSecondaire(sentences, normalizedSentences, statutConfig) {
  return findBestMatch(statutConfig.profil_type?.secondaire, sentences, normalizedSentences);
}

/**
 * Garde-fou section 9 du brief V2 : "Mes clients manquent de temps" ne doit
 * jamais devenir "le prospect manque de temps". Une exception whiteliste le
 * cas ou parler de "mes clients" decrit bien la charge DU PROSPECT lui-meme
 * (ex: "le suivi de mes clients me prend du temps").
 */
function isClientPainNotProspect(evidenceSentence, statutConfig) {
  if (!evidenceSentence) return false;
  const normalized = normalizeForMatch(evidenceSentence);
  const exceptions = statutConfig.client_pain_guard_exceptions || [];
  if (exceptions.some((p) => new RegExp(p, 'i').test(normalized))) return false;
  const guards = statutConfig.client_pain_guard || [];
  return guards.some((p) => new RegExp(p, 'i').test(normalized));
}

function disambiguateContext(evidenceSentence, statutConfig) {
  if (!evidenceSentence) return 'non_determine';
  const normalized = normalizeForMatch(evidenceSentence);
  for (const ctx of ['salarie_interne', 'freelance_prestataire', 'associe']) {
    const rules = statutConfig.contexte_signal[ctx] || [];
    for (const rule of rules) {
      let regex;
      try {
        regex = new RegExp(rule.pattern, 'i');
      } catch {
        continue;
      }
      if (regex.test(normalized)) return ctx;
    }
  }
  return 'non_determine';
}

const AMBIGUOUS_INTENT_KEYS = new Set(['intention.recrutement', 'intention.recherche_aide_prestataire']);

function downgradeConfidence(confidence) {
  if (confidence === 'high') return 'medium';
  if (confidence === 'medium') return 'low';
  return 'low';
}

/**
 * Determine la qualification ICP (section 11). Le statut salarie est
 * toujours disqualifiant (HORS_ICP), quel que soit le vocabulaire de coach/
 * formateur employe. A defaut de preuve suffisante dans un sens ou l'autre,
 * on retourne 'A_VERIFIER' plutot que d'inventer un verdict definitif : ni
 * ICP_PRINCIPAL/SECONDAIRE (on ne peut pas le confirmer), ni HORS_ICP
 * (l'absence de preuve n'est pas la preuve du contraire).
 */
function computeIcpAssessment({ statut, activitePropre, hasCoachPrincipalSignal, profilSecondaireMatch }) {
  if (SALARIE_STATUTS.includes(statut)) {
    return {
      qualification: 'HORS_ICP',
      reason: `Statut salarie detecte (${statut}) : hors ICP quel que soit le vocabulaire employe (section 6/11 du brief V2).`
    };
  }

  const isIndependantLeaning = INDEPENDANT_STATUTS.includes(statut);

  if (activitePropre.value === 'CONFIRMEE' && hasCoachPrincipalSignal) {
    return { qualification: 'ICP_PRINCIPAL', reason: 'Coach business/entrepreneuriat avec activite propre demontree.' };
  }

  if (activitePropre.value === 'CONFIRMEE' && profilSecondaireMatch) {
    return {
      qualification: 'ICP_SECONDAIRE',
      reason: 'Formateur/expert/consultant independant avec activite propre demontree.'
    };
  }

  if (activitePropre.value === 'CONFIRMEE' && isIndependantLeaning) {
    return { qualification: 'ICP_SECONDAIRE', reason: 'Statut independant avec activite propre demontree, sans vocabulaire coach explicite.' };
  }

  if ((hasCoachPrincipalSignal || profilSecondaireMatch || isIndependantLeaning) && activitePropre.value === 'NON_DEMONTREE') {
    return {
      qualification: 'A_VERIFIER',
      reason: "Vocabulaire coach/formateur/independant present, mais aucune activite propre demontree dans ce texte (offre, clients personnels, entreprise) : a confirmer, jamais suppose."
    };
  }

  return {
    qualification: 'A_VERIFIER',
    reason: 'Informations insuffisantes dans ce texte pour statuer sur le statut professionnel ou l\'activite propre.'
  };
}

/**
 * Construit le jeu de signaux V1 (memes cles que config/signals.json) a
 * transmettre TEL QUEL au moteur existant (qualification -> scoring ->
 * temperature -> offre -> action). C'est le seul endroit ou la couche
 * semantique "touche" au moteur V1, et elle ne fait que choisir quelles
 * preuves comptent, jamais comment elles sont notees.
 */
function toV1Signals(baseSignals, { icpAssessment, signalsWithContext }) {
  const signals = JSON.parse(JSON.stringify(baseSignals));

  if (icpAssessment.qualification === 'HORS_ICP') {
    signals.exclusion.hors_cible = true;
  }

  // Le +15 FIT "coach business/entrepreneuriat" n'est accorde par la couche
  // semantique que si l'ICP est confirme (principal OU secondaire) avec une
  // activite propre demontree - jamais sur un simple mot-cle isole
  // ("formateur = +15" est explicitement proscrit par le brief V2).
  signals.fit.coach_business_entrepreneuriat =
    icpAssessment.qualification === 'ICP_PRINCIPAL' || icpAssessment.qualification === 'ICP_SECONDAIRE';

  // Garde-fou "probleme du prospect vs probleme de ses clients" + contexte
  // "recrutement salarie interne" : ces signaux sont retires du jeu transmis
  // au scoring existant s'ils ne concernent pas reellement une opportunite
  // pour Dina.
  for (const entry of signalsWithContext) {
    if (entry.excludedAsClientPain) {
      signals[entry.category][entry.rawKey] = false;
    }
    if (AMBIGUOUS_INTENT_KEYS.has(entry.key) && entry.context === 'salarie_interne') {
      signals[entry.category][entry.rawKey] = false;
    }
  }

  return signals;
}

/**
 * Point d'entree principal de la couche semantique V2.
 *
 * `config` doit fournir les cles chargees par src/config.js : extraction,
 * signals, icp, statut.
 */
export function analyzeSemantic({ text = '', pays = '' } = {}, config) {
  const base = extractFromText({ text, pays }, config);
  const sentences = splitSentences(text);
  const normalizedSentences = sentences.map(normalizeForMatch);
  const statutConfig = config.statut;

  const statutResult = detectStatutProfessionnel(sentences, normalizedSentences, statutConfig);
  const activitePropre = detectActivitePropre(sentences, normalizedSentences, statutConfig);
  const offreTriState = detectOffreTriState(sentences, normalizedSentences, statutConfig);
  const profilSecondaireMatch = detectProfilTypeSecondaire(sentences, normalizedSentences, statutConfig);
  const hasCoachPrincipalSignal = base.signals.fit.coach_business_entrepreneuriat === true;

  const icpAssessment = computeIcpAssessment({
    statut: statutResult.statut,
    activitePropre,
    hasCoachPrincipalSignal,
    profilSecondaireMatch: Boolean(profilSecondaireMatch)
  });

  // Enrichit chaque preuve d'extraction avec son contexte (section 5) et
  // applique le garde-fou "probleme du prospect vs probleme de ses clients"
  // (section 9).
  const signalsWithContext = base.evidences.map((entry) => {
    const key = `${entry.category}.${entry.key}`;
    const isAmbiguousIntent = AMBIGUOUS_INTENT_KEYS.has(key);
    const context = isAmbiguousIntent ? disambiguateContext(entry.evidence, statutConfig) : null;
    const excludedAsClientPain =
      (entry.category === 'probleme' || entry.category === 'intention') &&
      entry.key !== 'experience_client' &&
      isClientPainNotProspect(entry.evidence, statutConfig);

    let displayConfidence = entry.confidence;
    if (isAmbiguousIntent && context === 'non_determine') {
      displayConfidence = downgradeConfidence(entry.confidence);
    }

    return {
      name: entry.label,
      key,
      evidence: entry.evidence,
      confidence: displayConfidence,
      context: isAmbiguousIntent ? context : null,
      applied: entry.applied && !excludedAsClientPain && !(isAmbiguousIntent && context === 'salarie_interne'),
      excludedAsClientPain,
      category: entry.category,
      rawKey: entry.key
    };
  });

  const v1Signals = toV1Signals(base.signals, { icpAssessment, signalsWithContext });

  const facts = signalsWithContext.filter((s) => s.applied).map((s) => s.evidence);
  const hypotheses = [
    ...base.hypotheses,
    ...signalsWithContext.filter((s) => s.excludedAsClientPain).map((s) => `${s.name} concerne les clients du prospect, pas le prospect lui-meme (a confirmer) : ${s.evidence}`),
    ...signalsWithContext
      .filter((s) => AMBIGUOUS_INTENT_KEYS.has(s.key) && s.context === 'salarie_interne')
      .map((s) => `${s.name} identifie comme un recrutement salarie interne, pas une opportunite pour Dina : ${s.evidence}`)
  ];

  return {
    facts: [...new Set(facts)],
    hypotheses: [...new Set(hypotheses)],
    signals: signalsWithContext.map(({ name, evidence, confidence, context }) => ({ name, evidence, confidence, context })),
    evidence: signalsWithContext.map((s) => ({ signal: s.name, quote: s.evidence })),
    context: {
      statut_professionnel: statutResult.statut,
      statut_evidence: statutResult.evidence,
      activite_propre: activitePropre.value,
      activite_propre_evidence: activitePropre.evidence,
      offre_commercialisee: offreTriState.value,
      offre_commercialisee_evidence: offreTriState.evidence
    },
    confidence: {
      global: base.niveau_confiance_extraction,
      statut: statutResult.confidence,
      activite_propre: activitePropre.confidence,
      offre: offreTriState.confidence
    },
    icp_assessment: icpAssessment,
    champs_deduits: base.champs_deduits,
    v1_signals: v1Signals,
    signalsDetailByKey: signalsWithContext
  };
}
