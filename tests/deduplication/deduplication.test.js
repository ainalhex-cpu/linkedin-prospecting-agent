import test from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicate, normalizeUrl } from '../../src/deduplication/index.js';
import { buildProspect } from '../fixtures.js';

test('normalizeUrl ignore protocole, www, slash final et casse', () => {
  assert.equal(
    normalizeUrl('https://www.linkedin.com/in/JeanDupont/'),
    normalizeUrl('linkedin.com/in/jeandupont')
  );
});

test('detecte un doublon via URL LinkedIn identique', () => {
  const existing = buildProspect({ url_linkedin: 'https://www.linkedin.com/in/marie-dupont/' });
  const candidate = buildProspect({ url_linkedin: 'https://linkedin.com/in/marie-dupont' });
  const { match, matchedOn } = findDuplicate(candidate, [existing]);
  assert.equal(match.id, existing.id);
  assert.equal(matchedOn, 'url_linkedin');
});

test('detecte un doublon via linkedin_id', () => {
  const existing = buildProspect({ linkedin_id: 'abc123' });
  const candidate = buildProspect({ linkedin_id: 'abc123' });
  const { match, matchedOn } = findDuplicate(candidate, [existing]);
  assert.equal(match.id, existing.id);
  assert.equal(matchedOn, 'linkedin_id');
});

test('detecte un doublon via prenom + nom + entreprise', () => {
  const existing = buildProspect({ prenom: 'Marie', nom: 'Dupont', entreprise: 'Coaching MD' });
  const candidate = buildProspect({ prenom: 'marie', nom: 'DUPONT', entreprise: 'coaching md' });
  const { match, matchedOn } = findDuplicate(candidate, [existing]);
  assert.equal(match.id, existing.id);
  assert.equal(matchedOn, 'nom_prenom_entreprise');
});

test('pas de doublon si aucun critere ne correspond', () => {
  const existing = buildProspect({ prenom: 'Marie', nom: 'Dupont', entreprise: 'Coaching MD' });
  const candidate = buildProspect({ prenom: 'Julien', nom: 'Korn', entreprise: 'Autre' });
  const { match } = findDuplicate(candidate, [existing]);
  assert.equal(match, null);
});
