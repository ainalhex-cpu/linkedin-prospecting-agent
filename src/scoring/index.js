/**
 * Moteur de scoring. Purement fonctionnel : (signals, config.scoring) -> scores.
 * Ne prend jamais de decision metier (temperature, offre) : ca c'est le role
 * des autres moteurs, en aval.
 */
export function calculateScore(signals, scoringConfig) {
  const scores = {};
  const breakdown = {};

  for (const [categoryKey, category] of Object.entries(scoringConfig.categories)) {
    let total = 0;
    const matched = [];
    const categorySignals = signals?.[categoryKey] || {};

    for (const criterion of category.criteria) {
      if (categorySignals[criterion.key] === true) {
        total += criterion.points;
        matched.push({ key: criterion.key, label: criterion.label, points: criterion.points });
      }
    }

    scores[categoryKey] = total;
    breakdown[categoryKey] = matched;
  }

  const score_total = Object.values(scores).reduce((sum, v) => sum + v, 0);

  return {
    score_fit: scores.fit ?? 0,
    score_maturite: scores.maturite ?? 0,
    score_probleme: scores.probleme ?? 0,
    score_intention: scores.intention ?? 0,
    score_total,
    breakdown
  };
}
