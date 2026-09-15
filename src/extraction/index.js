/**
 * Moteur d'extraction de signaux a partir d'un texte brut (profil LinkedIn
 * colle a la main, posts, description...). Ce module ne fait AUCUN scoring
 * et ne prend AUCUNE decision metier : il transforme du texte en donnees
 * structurees (signaux + preuves + confiance), que src/analysis (moteur
 * existant, inchange) consomme ensuite exactement comme des signaux saisis
 * a la main via les cases a cocher de l'interface.
 *
 * Principe non negociable : un signal n'est jamais invente. Il n'est
 * retenu que si une preuve litterale (une phrase du texte fourni) le
 * confirme. La "confidence" d'une regle indique la force du signal
 * linguistique, pas une decision de score.
 */

const CONFIDENCE_PRIORITY = { high: 3, medium: 2, low: 1 };

function stripDiacritics(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalizeForMatch(str) {
  return stripDiacritics(str).toLowerCase();
}

/**
 * Decoupe le texte en phrases/lignes exploitables comme "preuve". On garde
 * le texte original (accents, casse) pour l'affichage, et on matche sur une
 * version normalisee en parallele.
 */
function splitSentences(text) {
  const lines = String(text || '').split(/\r?\n/);
  const sentences = [];
  for (const line of lines) {
    const parts = line.split(/(?<=[.!?])\s+/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed) sentences.push(trimmed);
    }
  }
  return sentences;
}

function emptySignalsFor(patternsConfig) {
  const signals = {};
  for (const category of Object.keys(patternsConfig.categories)) {
    signals[category] = {};
    for (const key of Object.keys(patternsConfig.categories[category])) {
      signals[category][key] = false;
    }
  }
  return signals;
}

function isConfidenceApplied(category, confidence, patternsConfig) {
  const minConfidence = patternsConfig.apply_min_confidence?.[category] || 'medium';
  return CONFIDENCE_PRIORITY[confidence] >= CONFIDENCE_PRIORITY[minConfidence];
}

function dedupe(list) {
  return [...new Set(list.filter(Boolean))];
}

/**
 * Cherche, pour un signal (categorie+cle) donne, la regle de plus haute
 * confiance dont le pattern est trouve dans le texte, et la phrase qui la
 * justifie. Retourne null si aucune regle ne correspond (rien invente).
 */
function matchSignal(rules, sentences, normalizedSentences) {
  let best = null;
  for (const rule of rules) {
    let regex;
    try {
      regex = new RegExp(rule.pattern, 'i');
    } catch {
      continue; // pattern de config invalide : ignore silencieusement, ne bloque pas l'extraction
    }
    const index = normalizedSentences.findIndex((s) => regex.test(s));
    if (index === -1) continue;
    if (!best || CONFIDENCE_PRIORITY[rule.confidence] > CONFIDENCE_PRIORITY[best.confidence]) {
      best = { confidence: rule.confidence, evidence: sentences[index] };
    }
  }
  return best;
}

/**
 * Determine si le pays fourni correspond a un marche francophone prioritaire
 * (config/icp.json). C'est une correspondance litterale sur un champ
 * structure (pas une interpretation de texte libre), donc traite a part.
 */
function detectFrancophoneMarket(pays, icpConfig) {
  if (!pays) return null;
  const normalizedPays = normalizeForMatch(pays);
  const match = (icpConfig?.pays_francophones_prioritaires || []).find(
    (entry) => normalizeForMatch(entry.pays) === normalizedPays
  );
  return match ? { confidence: 'high', evidence: `Pays renseigne : ${pays}` } : null;
}

function computeGlobalConfidence(evidences) {
  const applied = evidences.filter((e) => e.applied);
  if (applied.length === 0) return 'FAIBLE';
  const highCount = applied.filter((e) => e.confidence === 'high').length;
  const mediumCount = applied.filter((e) => e.confidence === 'medium').length;
  if (highCount >= 2) return 'ELEVE';
  if (highCount >= 1 || mediumCount >= 2) return 'MOYEN';
  return 'FAIBLE';
}

/**
 * Deduit quelques champs texte du prospect (type_prospect, activite, offre,
 * audience) a partir des PREUVES LITTERALES deja extraites (jamais de texte
 * invente : on ne fait que reutiliser des phrases reellement presentes).
 */
function deriveTextFields(evidenceByKey, signalsLabels) {
  const fitEvidence = evidenceByKey['fit.coach_business_entrepreneuriat'];
  const offreEvidence = evidenceByKey['maturite.offre_commercialisee'];
  const audienceEvidence = evidenceByKey['maturite.clients_audience_etablis'];

  return {
    type_prospect: fitEvidence && fitEvidence.applied ? signalsLabels.coach_business_entrepreneuriat : null,
    activite: fitEvidence && fitEvidence.applied ? fitEvidence.evidence : null,
    offre: offreEvidence && offreEvidence.applied ? offreEvidence.evidence : null,
    audience: audienceEvidence && audienceEvidence.applied ? audienceEvidence.evidence : null
  };
}

/**
 * Point d'entree principal. `config` doit fournir `extraction` (ce fichier
 * de patterns), `signals` (catalogue/labels existant) et `icp` (liste des
 * marches francophones existante).
 *
 * Retourne des donnees structurees pretes a etre transmises telles quelles
 * au moteur existant (qualification -> scoring -> temperature -> offre ->
 * action), sans aucune duplication de ces regles ici.
 */
export function extractFromText({ text = '', pays = '' } = {}, config) {
  const patternsConfig = config.extraction;
  const signals = emptySignalsFor(patternsConfig);
  const sentences = splitSentences(text);
  const normalizedSentences = sentences.map(normalizeForMatch);

  const evidences = [];
  const evidenceByKey = {};
  const faits_observes = [];
  const hypotheses = [];

  for (const category of Object.keys(patternsConfig.categories)) {
    for (const key of Object.keys(patternsConfig.categories[category])) {
      const rules = patternsConfig.categories[category][key];
      if (!rules || rules.length === 0) continue;

      const match = matchSignal(rules, sentences, normalizedSentences);
      if (!match) continue;

      const applied = isConfidenceApplied(category, match.confidence, patternsConfig);
      const label = config.signals.labels?.[key] || key;

      if (applied) signals[category][key] = true;

      const entry = { category, key, label, evidence: match.evidence, confidence: match.confidence, applied };
      evidences.push(entry);
      evidenceByKey[`${category}.${key}`] = entry;

      if (applied) {
        faits_observes.push(match.evidence);
      } else {
        hypotheses.push(`${label} (a confirmer) : ${match.evidence}`);
      }
    }
  }

  const francophoneMatch = detectFrancophoneMarket(pays, config.icp);
  if (francophoneMatch) {
    signals.fit.marche_francophone = true;
    evidences.push({
      category: 'fit',
      key: 'marche_francophone',
      label: config.signals.labels?.marche_francophone || 'Marche francophone',
      evidence: francophoneMatch.evidence,
      confidence: francophoneMatch.confidence,
      applied: true
    });
    faits_observes.push(francophoneMatch.evidence);
  }

  const champs_deduits = deriveTextFields(evidenceByKey, config.signals.labels || {});

  return {
    signals,
    evidences,
    faits_observes: dedupe(faits_observes),
    hypotheses: dedupe(hypotheses),
    champs_deduits,
    niveau_confiance_extraction: computeGlobalConfidence(evidences)
  };
}
