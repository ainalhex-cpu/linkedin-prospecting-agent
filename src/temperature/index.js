/**
 * Moteur de temperature. Regle cle du cahier des charges :
 * un score >= hot_min NE SUFFIT PAS pour etre HOT, il faut aussi au moins
 * un signal d'intention reel. Sinon le prospect est retrograde en WARM :
 * excellent fit, mais aucune preuve d'intention d'achat/de delegation.
 */
export function hasIntentionSignal(signals) {
  const intention = signals?.intention || {};
  return Object.values(intention).some((v) => v === true);
}

export function determineTemperature(scoreTotal, signals, thresholdsConfig) {
  if (scoreTotal >= thresholdsConfig.hot_min) {
    if (!thresholdsConfig.hot_requires_intention_signal || hasIntentionSignal(signals)) {
      return 'HOT';
    }
    return thresholdsConfig.hot_downgrade_temperature || 'WARM';
  }
  if (scoreTotal >= thresholdsConfig.warm_min) {
    return 'WARM';
  }
  return 'COLD';
}
