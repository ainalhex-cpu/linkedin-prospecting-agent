/**
 * Moteur de qualification : verifie les criteres d'exclusion AVANT tout score.
 * Un prospect exclu ne doit jamais recevoir de score invente : on stoppe la
 * pipeline d'analyse et on documente pourquoi.
 */
export function qualify(signals, signalsConfig) {
  const exclusion = signals?.exclusion || {};
  const raisons = [];

  const keys = signalsConfig?.categories?.exclusion || Object.keys(exclusion);
  for (const key of keys) {
    if (exclusion[key] === true) {
      raisons.push({
        key,
        label: signalsConfig?.labels?.[key] || key
      });
    }
  }

  return {
    excluded: raisons.length > 0,
    raisons
  };
}
