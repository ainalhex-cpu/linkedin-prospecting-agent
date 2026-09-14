import test from 'node:test';
import assert from 'node:assert/strict';
import { matchOffer } from '../../src/offer_matching/index.js';
import { config } from '../fixtures.js';
import { emptySignals } from '../../src/schema/prospect.js';

test('aucun signal probleme -> NON_IDENTIFIE', () => {
  const result = matchOffer(emptySignals(), config.offers);
  assert.equal(result.offre, 'NON_IDENTIFIE');
});

test('signaux manque_de_temps + communication -> VISIBILITE', () => {
  const signals = emptySignals();
  signals.probleme.manque_de_temps = true;
  signals.probleme.communication = true;
  const result = matchOffer(signals, config.offers);
  assert.equal(result.offre, 'VISIBILITE');
});

test('signaux organisation + experience_client -> SERENITE', () => {
  const signals = emptySignals();
  signals.probleme.organisation = true;
  signals.probleme.experience_client = true;
  const result = matchOffer(signals, config.offers);
  assert.equal(result.offre, 'SERENITE');
});

test('signaux VISIBILITE + SERENITE simultanes -> LIBERTE (pas une addition mecanique)', () => {
  const signals = emptySignals();
  signals.probleme.communication = true; // visibilite
  signals.probleme.organisation = true; // serenite
  const result = matchOffer(signals, config.offers);
  assert.equal(result.offre, 'LIBERTE');
});

test('equipe_ou_prestataires seul declenche LIBERTE meme sans probleme visibilite/serenite', () => {
  const signals = emptySignals();
  signals.contexte.equipe_ou_prestataires = true;
  const result = matchOffer(signals, config.offers);
  assert.equal(result.offre, 'LIBERTE');
});

test('plusieurs_offres declenche LIBERTE', () => {
  const signals = emptySignals();
  signals.contexte.plusieurs_offres = true;
  const result = matchOffer(signals, config.offers);
  assert.equal(result.offre, 'LIBERTE');
});
