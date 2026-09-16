import test from 'node:test';
import assert from 'node:assert/strict';
import { computeOpportunity } from '../../src/opportunity/index.js';
import { config } from '../fixtures.js';

function fakeSemanticResult(icpQualification, signalsDetailByKey) {
  return { icp_assessment: { qualification: icpQualification }, signalsDetailByKey };
}

test('aucun signal applique -> intention NO, opportunite FAIBLE', () => {
  const result = computeOpportunity(fakeSemanticResult('ICP_PRINCIPAL', []), config);
  assert.equal(result.intention_level, 'NO');
  assert.equal(result.opportunity_level, 'FAIBLE');
});

test('signal HIGH + ICP_PRINCIPAL -> opportunite FORTE', () => {
  const result = computeOpportunity(
    fakeSemanticResult('ICP_PRINCIPAL', [
      { key: 'intention.recherche_aide_prestataire', name: 'Recherche aide', evidence: '...', applied: true, context: null }
    ]),
    config
  );
  assert.equal(result.intention_level, 'HIGH');
  assert.equal(result.opportunity_level, 'FORTE');
});

test('meme signal HIGH mais HORS_ICP -> opportunite FAIBLE (le fit doit etre reel)', () => {
  const result = computeOpportunity(
    fakeSemanticResult('HORS_ICP', [
      { key: 'intention.recherche_aide_prestataire', name: 'Recherche aide', evidence: '...', applied: true, context: null }
    ]),
    config
  );
  assert.equal(result.opportunity_level, 'FAIBLE');
});

test("intention.recrutement en contexte salarie_interne est retrograde a NO", () => {
  const result = computeOpportunity(
    fakeSemanticResult('ICP_PRINCIPAL', [
      { key: 'intention.recrutement', name: 'Recrutement', evidence: '...', applied: true, context: 'salarie_interne' }
    ]),
    config
  );
  assert.equal(result.intention_level, 'NO');
});

test('intention.recrutement en contexte freelance_prestataire est promu a HIGH', () => {
  const result = computeOpportunity(
    fakeSemanticResult('ICP_PRINCIPAL', [
      { key: 'intention.recrutement', name: 'Recrutement', evidence: '...', applied: true, context: 'freelance_prestataire' }
    ]),
    config
  );
  assert.equal(result.intention_level, 'HIGH');
  assert.equal(result.opportunity_level, 'FORTE');
});

test('les signaux non retenus (applied=false) ne comptent pas dans l\'intention', () => {
  const result = computeOpportunity(
    fakeSemanticResult('ICP_PRINCIPAL', [
      { key: 'intention.recherche_aide_prestataire', name: 'Recherche aide', evidence: '...', applied: false, context: null }
    ]),
    config
  );
  assert.equal(result.intention_level, 'NO');
});

test('ICP_SECONDAIRE plafonne l\'opportunite a MOYENNE meme avec une intention HIGH', () => {
  const result = computeOpportunity(
    fakeSemanticResult('ICP_SECONDAIRE', [
      { key: 'intention.recherche_aide_prestataire', name: 'Recherche aide', evidence: '...', applied: true, context: null }
    ]),
    config
  );
  assert.equal(result.opportunity_level, 'MOYENNE');
});
