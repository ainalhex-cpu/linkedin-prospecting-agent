import test from 'node:test';
import assert from 'node:assert/strict';
import { qualify } from '../../src/qualification/index.js';
import { config } from '../fixtures.js';
import { emptySignals } from '../../src/schema/prospect.js';

test('aucun signal exclusion -> non exclu', () => {
  const result = qualify(emptySignals(), config.signals);
  assert.equal(result.excluded, false);
  assert.deepEqual(result.raisons, []);
});

test('un seul signal exclusion suffit a exclure', () => {
  const signals = emptySignals();
  signals.exclusion.debutant = true;
  const result = qualify(signals, config.signals);
  assert.equal(result.excluded, true);
  assert.equal(result.raisons.length, 1);
  assert.equal(result.raisons[0].key, 'debutant');
});

test('informations_insuffisantes exclut le prospect', () => {
  const signals = emptySignals();
  signals.exclusion.informations_insuffisantes = true;
  const result = qualify(signals, config.signals);
  assert.equal(result.excluded, true);
});

test('plusieurs raisons d\'exclusion sont toutes rapportees', () => {
  const signals = emptySignals();
  signals.exclusion.debutant = true;
  signals.exclusion.aucune_offre = true;
  const result = qualify(signals, config.signals);
  assert.equal(result.raisons.length, 2);
});
