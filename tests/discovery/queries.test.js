import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchQueries } from '../../src/discovery/web.js';
import { config } from '../fixtures.js';

// Test 1 : generation de requetes
test('1 - genere une requete par mot-cle du template, combinee au pays', () => {
  const queries = buildSearchQueries({ country: 'France', profile_type: 'coach_business' }, config.discoveryQueries);
  assert.ok(queries.length >= 3);
  assert.ok(queries.every((q) => q.endsWith('France')));
  assert.ok(queries.some((q) => q.includes('coach business')));
  assert.ok(queries.some((q) => q.includes('coach entrepreneuriat')));
});

test("les templates viennent de la config, jamais codes en dur dans le moteur", () => {
  const customConfig = {
    ...config.discoveryQueries,
    templates: { ...config.discoveryQueries.templates, coach_business: ['mot-cle sur mesure'] }
  };
  const queries = buildSearchQueries({ country: 'Belgique', profile_type: 'coach_business' }, customConfig);
  assert.deepEqual(queries, ['"mot-cle sur mesure" Belgique']);
});

test('des mots-cles explicites remplacent les templates par defaut', () => {
  const queries = buildSearchQueries({ country: 'France', keywords: ['mentor startup'] }, config.discoveryQueries);
  assert.deepEqual(queries, ['"mentor startup" France']);
});

test('sans pays, la requete reste valide (pas de marche accole)', () => {
  const queries = buildSearchQueries({ profile_type: 'coach_business' }, config.discoveryQueries);
  assert.ok(queries.every((q) => !q.includes('undefined')));
});

test('un profile_type inconnu retombe sur le type par defaut de la config', () => {
  const queries = buildSearchQueries({ country: 'France', profile_type: 'inexistant' }, config.discoveryQueries);
  assert.ok(queries.length > 0);
});

test('les marches francophones prevus sont bien listes dans la config (section 2 du brief V3)', () => {
  const marches = config.discoveryQueries.marches_francophones;
  for (const marche of ['France', 'Belgique', 'Suisse', 'Canada francophone']) {
    assert.ok(marches.includes(marche), `${marche} devrait etre dans la liste des marches`);
  }
});
