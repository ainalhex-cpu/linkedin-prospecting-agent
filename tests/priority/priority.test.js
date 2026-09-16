import test from 'node:test';
import assert from 'node:assert/strict';
import { computePriority } from '../../src/priority/index.js';

test('HORS_ICP -> toujours IGNORE, quelle que soit l\'opportunite', () => {
  assert.equal(computePriority({ icpQualification: 'HORS_ICP', opportunityLevel: 'FORTE', temperature: 'HOT' }), 'IGNORE');
});

test('temperature IGNORE (exclusion V1) -> toujours IGNORE', () => {
  assert.equal(computePriority({ icpQualification: 'ICP_PRINCIPAL', opportunityLevel: 'FORTE', temperature: 'IGNORE' }), 'IGNORE');
});

test('ICP_PRINCIPAL + opportunite FORTE -> priorite A', () => {
  assert.equal(computePriority({ icpQualification: 'ICP_PRINCIPAL', opportunityLevel: 'FORTE', temperature: 'HOT' }), 'A');
});

test('ICP_PRINCIPAL + opportunite FAIBLE -> priorite B (excellent ICP, intention faible)', () => {
  assert.equal(computePriority({ icpQualification: 'ICP_PRINCIPAL', opportunityLevel: 'FAIBLE', temperature: 'COLD' }), 'B');
});

test('ICP_SECONDAIRE + opportunite FORTE -> priorite B', () => {
  assert.equal(computePriority({ icpQualification: 'ICP_SECONDAIRE', opportunityLevel: 'FORTE', temperature: 'WARM' }), 'B');
});

test('ICP_SECONDAIRE + opportunite FAIBLE -> priorite C', () => {
  assert.equal(computePriority({ icpQualification: 'ICP_SECONDAIRE', opportunityLevel: 'FAIBLE', temperature: 'COLD' }), 'C');
});

test('A_VERIFIER ne peut jamais atteindre la priorite A, meme avec une opportunite forte', () => {
  const result = computePriority({ icpQualification: 'A_VERIFIER', opportunityLevel: 'FORTE', temperature: 'WARM' });
  assert.notEqual(result, 'A');
  assert.equal(result, 'B');
});

test('A_VERIFIER + opportunite faible -> priorite C', () => {
  assert.equal(computePriority({ icpQualification: 'A_VERIFIER', opportunityLevel: 'FAIBLE', temperature: 'COLD' }), 'C');
});
