import test from 'node:test';
import assert from 'node:assert/strict';
import { determineTemperature, hasIntentionSignal } from '../../src/temperature/index.js';
import { config } from '../fixtures.js';
import { emptySignals } from '../../src/schema/prospect.js';

test('score >= 80 avec signal d\'intention -> HOT', () => {
  const signals = emptySignals();
  signals.intention.recrutement = true;
  const temp = determineTemperature(85, signals, config.thresholds);
  assert.equal(temp, 'HOT');
});

test('score >= 80 SANS signal d\'intention -> retrograde en WARM', () => {
  const signals = emptySignals();
  const temp = determineTemperature(85, signals, config.thresholds);
  assert.equal(temp, 'WARM');
});

test('score entre 60 et 79 -> WARM', () => {
  const signals = emptySignals();
  const temp = determineTemperature(70, signals, config.thresholds);
  assert.equal(temp, 'WARM');
});

test('score < 60 -> COLD', () => {
  const signals = emptySignals();
  const temp = determineTemperature(45, signals, config.thresholds);
  assert.equal(temp, 'COLD');
});

test('hasIntentionSignal detecte au moins un true', () => {
  const signals = emptySignals();
  assert.equal(hasIntentionSignal(signals), false);
  signals.intention.croissance_importante_lancement = true;
  assert.equal(hasIntentionSignal(signals), true);
});
