import test from 'node:test';
import assert from 'node:assert/strict';
import { prioritize, topProspects, isValidStatut, moveStatut } from '../../src/pipeline/index.js';
import { config, buildProspect } from '../fixtures.js';

test('isValidStatut valide les statuts connus uniquement', () => {
  assert.equal(isValidStatut('Nouveau', config.pipeline), true);
  assert.equal(isValidStatut('Statut inexistant', config.pipeline), false);
});

test('moveStatut refuse un statut invalide', () => {
  const p = buildProspect();
  assert.throws(() => moveStatut(p, 'Inexistant', config.pipeline));
});

test('prioritize exclut les prospects IGNORE', () => {
  const hot = { ...buildProspect(), score_fit: 30, score_maturite: 20, score_probleme: 20, score_intention: 10, temperature: 'HOT' };
  const ignored = { ...buildProspect(), score_fit: 30, score_maturite: 20, score_probleme: 30, score_intention: 20, temperature: 'IGNORE' };
  const result = prioritize([hot, ignored]);
  assert.equal(result.length, 1);
  assert.equal(result[0].temperature, 'HOT');
});

test('prioritize trie par score_fit puis maturite puis probleme puis intention', () => {
  const a = { ...buildProspect(), score_fit: 30, score_maturite: 10, score_probleme: 10, score_intention: 0, temperature: 'WARM' };
  const b = { ...buildProspect(), score_fit: 15, score_maturite: 20, score_probleme: 30, score_intention: 20, temperature: 'HOT' };
  const result = prioritize([b, a]);
  assert.equal(result[0].id, a.id); // score_fit plus eleve gagne en premier critere
});

test('topProspects limite le nombre de resultats', () => {
  const prospects = Array.from({ length: 15 }, (_, i) => ({
    ...buildProspect(),
    score_fit: i,
    temperature: 'COLD'
  }));
  const top = topProspects(prospects, 10);
  assert.equal(top.length, 10);
});
