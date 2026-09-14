import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScore } from '../../src/scoring/index.js';
import { config } from '../fixtures.js';
import { emptySignals } from '../../src/schema/prospect.js';

test('score total = 0 quand aucun signal', () => {
  const result = calculateScore(emptySignals(), config.scoring);
  assert.equal(result.score_total, 0);
  assert.equal(result.score_fit, 0);
  assert.equal(result.score_maturite, 0);
  assert.equal(result.score_probleme, 0);
  assert.equal(result.score_intention, 0);
});

test('score FIT maximal = 30 points', () => {
  const signals = emptySignals();
  signals.fit.coach_business_entrepreneuriat = true;
  signals.fit.activite_etablie = true;
  signals.fit.marche_francophone = true;
  const result = calculateScore(signals, config.scoring);
  assert.equal(result.score_fit, 30);
});

test('score MATURITE maximal = 20 points', () => {
  const signals = emptySignals();
  Object.keys(signals.maturite).forEach((k) => (signals.maturite[k] = true));
  const result = calculateScore(signals, config.scoring);
  assert.equal(result.score_maturite, 20);
});

test('score PROBLEME maximal = 30 points', () => {
  const signals = emptySignals();
  Object.keys(signals.probleme).forEach((k) => (signals.probleme[k] = true));
  const result = calculateScore(signals, config.scoring);
  assert.equal(result.score_probleme, 30);
});

test('score INTENTION maximal = 20 points', () => {
  const signals = emptySignals();
  Object.keys(signals.intention).forEach((k) => (signals.intention[k] = true));
  const result = calculateScore(signals, config.scoring);
  assert.equal(result.score_intention, 20);
});

test('score total maximal = 100 points quand tous les signaux sont a true', () => {
  const signals = emptySignals();
  for (const category of ['fit', 'maturite', 'probleme', 'intention']) {
    Object.keys(signals[category]).forEach((k) => (signals[category][k] = true));
  }
  const result = calculateScore(signals, config.scoring);
  assert.equal(result.score_total, 100);
});

test('les signaux de contexte et exclusion ne contribuent pas au score', () => {
  const signals = emptySignals();
  signals.contexte.plusieurs_offres = true;
  signals.exclusion.debutant = true;
  const result = calculateScore(signals, config.scoring);
  assert.equal(result.score_total, 0);
});
