/**
 * Calcule l'INTENTION et l'OPPORTUNITE (section 4 et 10 du brief V2), deux
 * dimensions independantes du FIT et du score existant. Ce module ne
 * recalcule jamais le score /100 (source de verite : src/scoring, inchange)
 * : il classe la force des signaux d'intention deja extraits par
 * src/semantic-analysis sur l'echelle HIGH/MEDIUM/LOW/NO, puis en deduit un
 * niveau d'opportunite qui tient compte du FIT (un signal d'intention fort
 * chez un profil hors ICP reste une opportunite FAIBLE pour Dina).
 */

const LEVEL_ORDER = { HIGH: 3, MEDIUM: 2, LOW: 1, NO: 0 };

function levelForSignal(entry, intentConfig) {
  const key = entry.key;
  let level = intentConfig.base_levels[key] || intentConfig.default_level;
  const overrides = intentConfig.context_overrides[key];
  if (overrides && entry.context && overrides[entry.context]) {
    level = overrides[entry.context];
  }
  return level;
}

/**
 * `semanticResult` est le retour de src/semantic-analysis#analyzeSemantic.
 */
export function computeOpportunity(semanticResult, config) {
  const intentConfig = config.intentLevels;
  const contributions = [];
  let maxLevel = 'NO';

  for (const entry of semanticResult.signalsDetailByKey || []) {
    if (!entry.applied) continue;
    const level = levelForSignal(entry, intentConfig);
    contributions.push({ key: entry.key, name: entry.name, level, evidence: entry.evidence, context: entry.context });
    if (LEVEL_ORDER[level] > LEVEL_ORDER[maxLevel]) maxLevel = level;
  }

  const icpQualification = semanticResult.icp_assessment.qualification;
  const matrix = intentConfig.opportunity_matrix[icpQualification] || intentConfig.opportunity_matrix.A_VERIFIER;
  const opportunityLevel = matrix[maxLevel];

  const reason = contributions.length
    ? `Intention maximale detectee : ${maxLevel} (${contributions.map((c) => c.name).join(', ')}). ICP : ${icpQualification}.`
    : `Aucun signal d'intention retenu dans ce texte. ICP : ${icpQualification}.`;

  return {
    intention_level: maxLevel,
    opportunity_level: opportunityLevel,
    contributions,
    reason
  };
}
