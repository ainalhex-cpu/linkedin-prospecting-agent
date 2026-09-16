import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverProspects } from '../../src/discovery/index.js';

test('discoverProspects retourne des prospects bruts sans filtre', () => {
  const results = discoverProspects({});
  assert.ok(results.length > 0);
  assert.ok(results[0].texte_brut);
});

test('discoverProspects filtre par pays', () => {
  const results = discoverProspects({ country: 'Belgique' });
  assert.ok(results.length > 0);
  assert.ok(results.every((p) => p.pays === 'Belgique'));
});

test('discoverProspects filtre par type', () => {
  const results = discoverProspects({ type: 'formateur_salarie' });
  assert.ok(results.length > 0);
  assert.ok(results.every((p) => p.type === 'formateur_salarie'));
});

test('discoverProspects respecte la limite', () => {
  const results = discoverProspects({ limit: 2 });
  assert.equal(results.length, 2);
});

test('discoverProspects ne fait aucun appel reseau : renvoie toujours instantanement des donnees mock', () => {
  const before = Date.now();
  discoverProspects({ limit: 100 });
  assert.ok(Date.now() - before < 50);
});
