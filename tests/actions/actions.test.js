import test from 'node:test';
import assert from 'node:assert/strict';
import { computeActionV2, suggestComment, suggestMessage } from '../../src/actions/index.js';
import { config } from '../fixtures.js';

const NOW = new Date('2026-09-16T00:00:00Z');

// Test 10 : signal ancien
test('10 - un signal ancien (> seuil de recence) retrograde CONVERSATION en WARM_UP', () => {
  const oldDate = new Date('2026-01-01T00:00:00Z'); // ~8.5 mois avant NOW
  const result = computeActionV2(
    { v1Action: 'CONVERSATION', icpQualification: 'ICP_PRINCIPAL', signalDate: oldDate.toISOString(), now: NOW },
    config
  );
  assert.equal(result.action, 'WARM_UP');
  assert.match(result.reason, /ancien/i);
});

test('10bis - un signal ancien retrograde aussi WARM_UP en NURTURE', () => {
  const oldDate = new Date('2026-01-01T00:00:00Z');
  const result = computeActionV2(
    { v1Action: 'WARM_UP', icpQualification: 'ICP_PRINCIPAL', signalDate: oldDate.toISOString(), now: NOW },
    config
  );
  assert.equal(result.action, 'NURTURE');
});

// Test 11 : signal recent
test('11 - un signal recent conserve l\'action du moteur existant (CONVERSATION)', () => {
  const recentDate = new Date('2026-09-10T00:00:00Z'); // 6 jours avant NOW
  const result = computeActionV2(
    { v1Action: 'CONVERSATION', icpQualification: 'ICP_PRINCIPAL', signalDate: recentDate.toISOString(), now: NOW },
    config
  );
  assert.equal(result.action, 'CONVERSATION');
});

test('sans date de signal fournie, l\'action du moteur existant n\'est jamais penalisee', () => {
  const result = computeActionV2({ v1Action: 'CONVERSATION', icpQualification: 'ICP_PRINCIPAL', signalDate: null, now: NOW }, config);
  assert.equal(result.action, 'CONVERSATION');
});

test('un prospect HORS_ICP est toujours IGNORE, quelle que soit l\'action du moteur existant', () => {
  const result = computeActionV2({ v1Action: 'CONVERSATION', icpQualification: 'HORS_ICP', signalDate: null, now: NOW }, config);
  assert.equal(result.action, 'IGNORE');
});

test('la conservation de l\'historique : la raison de retrogradation est toujours explicite', () => {
  const oldDate = new Date('2026-01-01T00:00:00Z');
  const result = computeActionV2(
    { v1Action: 'CONVERSATION', icpQualification: 'ICP_PRINCIPAL', signalDate: oldDate.toISOString(), now: NOW },
    config
  );
  assert.ok(result.reason.length > 0);
});

test('suggestComment ne propose rien sans preuve reelle (jamais generique)', () => {
  assert.equal(suggestComment({ faits_observes: [] }), null);
});

test('suggestComment cite une preuve reelle du prospect', () => {
  const suggestion = suggestComment({ faits_observes: ['Je cherche un freelance pour mon operationnel.'] });
  assert.match(suggestion.brouillon, /freelance/);
});

test('suggestMessage n\'est propose que si l\'opportunite est FORTE', () => {
  const weak = suggestMessage({ prenom: 'Alec' }, { opportunity_level: 'FAIBLE', contributions: [] });
  assert.equal(weak, null);

  const strong = suggestMessage(
    { prenom: 'Alec' },
    { opportunity_level: 'FORTE', reason: 'Signal fort', contributions: [{ evidence: 'Je cherche un bras droit.' }] }
  );
  assert.ok(strong);
  assert.match(strong.brouillon, /bras droit/);
});
