/**
 * Moteur de detection de besoin -> offre.
 * Principe (section 9 du cahier des charges) : on detecte d'abord le
 * probleme observe, puis SEULEMENT ensuite on en deduit l'offre. On ne
 * force jamais un prospect dans une offre s'il n'y a pas de signal.
 */
function readSignal(signals, key) {
  return (
    signals?.probleme?.[key] === true ||
    signals?.maturite?.[key] === true ||
    signals?.contexte?.[key] === true ||
    signals?.intention?.[key] === true
  );
}

export function matchOffer(signals, offersConfig) {
  const visibiliteSignals = offersConfig.VISIBILITE.signals.filter((key) => readSignal(signals, key));
  const sereniteSignals = offersConfig.SERENITE.signals.filter((key) => readSignal(signals, key));
  const liberteExtraSignals = offersConfig.LIBERTE.extra_signals.filter((key) => readSignal(signals, key));

  const hasVisibilite = visibiliteSignals.length > 0;
  const hasSerenite = sereniteSignals.length > 0;
  const hasLiberteTrigger = liberteExtraSignals.length > 0 || (hasVisibilite && hasSerenite);

  if (hasLiberteTrigger) {
    return {
      offre: 'LIBERTE',
      signaux_detectes: [...new Set([...visibiliteSignals, ...sereniteSignals, ...liberteExtraSignals])],
      details: { visibiliteSignals, sereniteSignals, liberteExtraSignals }
    };
  }

  if (hasVisibilite) {
    return { offre: 'VISIBILITE', signaux_detectes: visibiliteSignals, details: { visibiliteSignals } };
  }

  if (hasSerenite) {
    return { offre: 'SERENITE', signaux_detectes: sereniteSignals, details: { sereniteSignals } };
  }

  return { offre: 'NON_IDENTIFIE', signaux_detectes: [], details: {} };
}
