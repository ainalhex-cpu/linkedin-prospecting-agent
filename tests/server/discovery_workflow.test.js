import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as api from '../../src/server/api.js';
import { config } from '../fixtures.js';
import { getDiscoverySource } from '../../src/discovery/index.js';

function tempDataFile() {
  const dir = mkdtempSync(path.join(tmpdir(), 'lpa-discovery-'));
  const filePath = path.join(dir, 'prospects.json');
  writeFileSync(filePath, '[]');
  return filePath;
}

// Test 6 : pipeline complet discovery -> analyse
test('6 - le pipeline complet (source web) va de la decouverte a l\'analyse V1/V2 sans casser le moteur existant', () => {
  const filePath = tempDataFile();
  const result = api.runProspectingWorkflow({ source: 'web', country: 'France', profile_type: 'coach_business', limit: 10 }, config, filePath);

  assert.equal(result.stats.source, 'web');
  assert.ok(result.stats.trouves > 0);
  assert.equal(result.stats.analyses, result.stats.trouves);

  for (const p of result.prospects) {
    // Champs du moteur existant (V1), inchanges
    assert.ok('temperature' in p);
    assert.ok('score_total' in p);
    assert.ok('offre_recommandee' in p);
    // Champs V2 additifs
    assert.ok('icp_assessment' in p);
    assert.ok('priorite' in p);
  }
});

// Test 7 : priorite (A/B/C/IGNORE bien peuplees par le workflow)
test('7 - les stats de priorite du workflow correspondent aux priorites reelles des prospects analyses', () => {
  const filePath = tempDataFile();
  const result = api.runProspectingWorkflow({ source: 'web', country: 'France', profile_type: 'coach_business', limit: 10 }, config, filePath);

  const recompute = { A: 0, B: 0, C: 0, IGNORE: 0 };
  for (const p of result.prospects) {
    if (recompute[p.priorite] !== undefined) recompute[p.priorite] += 1;
  }
  assert.deepEqual(result.stats.priorite, recompute);
});

// Test 8 + 9 : top N, jamais de padding artificiel
test('8/9 - getDailyProspects ne remplit jamais artificiellement : retourne moins que la limite si peu de prospects pertinents', () => {
  const filePath = tempDataFile();
  // Un seul type tres restrictif -> peu de candidats
  const top = api.getDailyProspects(10, { source: 'mock', type: 'formateur_salarie' }, config, filePath);
  assert.ok(top.length < 10, 'ne doit jamais artificiellement completer la liste jusqu\'a 10');
});

test('8 - getDailyProspects respecte la limite quand assez de prospects pertinents existent', () => {
  const filePath = tempDataFile();
  const top = api.getDailyProspects(3, { source: 'web', country: 'France', profile_type: 'coach_business' }, config, filePath);
  assert.ok(top.length <= 3);
});

// Test 11 : historique (premiere/derniere decouverte, mise a jour sans perte)
test('11 - une nouvelle decouverte du meme prospect met a jour derniere_decouverte sans perdre l\'historique existant', () => {
  const filePath = tempDataFile();
  const first = api.runProspectingWorkflow({ source: 'web', country: 'France', profile_type: 'coach_business', limit: 10 }, config, filePath);
  const sophie1 = first.prospects.find((p) => p.prenom === 'Sophie');
  assert.ok(sophie1);
  const premiereDecouverte1 = sophie1.date_decouverte;
  const scoreHistoryLength1 = sophie1.historique_score.length;

  const second = api.runProspectingWorkflow({ source: 'web', country: 'France', profile_type: 'coach_business', limit: 10 }, config, filePath);
  const sophie2 = second.prospects.find((p) => p.prenom === 'Sophie');

  assert.equal(sophie2.date_decouverte, premiereDecouverte1, 'la premiere decouverte ne doit jamais etre ecrasee');
  assert.notEqual(sophie2.derniere_decouverte, undefined);
  assert.ok(sophie2.historique_score.length >= scoreHistoryLength1, 'l\'historique doit etre conserve, jamais efface');
  assert.equal(api.listProspects(filePath).length, first.prospects.length, 'aucun doublon cree par la seconde decouverte');
});

// Test 13 : integration au briefing
test('13 - le briefing reflete les prospects issus du workflow de decouverte', () => {
  const filePath = tempDataFile();
  api.runProspectingWorkflow({ source: 'web', country: 'France', profile_type: 'coach_business', limit: 10 }, config, filePath);
  const briefing = api.getBriefingText(config, filePath);
  assert.match(briefing, /PROSPECTION DU JOUR/);
  // Au moins un des prospects decouverts doit apparaitre nommement dans le briefing
  const prospects = api.listProspects(filePath);
  const anyNamed = prospects.some((p) => briefing.includes(p.prenom));
  assert.ok(anyNamed);
});

test('runProspectingWorkflow reste retro-compatible avec la source mock par defaut (V2 inchange)', () => {
  const filePath = tempDataFile();
  const result = api.runProspectingWorkflow({ country: 'France', limit: 10 }, config, filePath);
  assert.equal(result.stats.source, 'mock');
  assert.ok(result.stats.trouves > 0);
});

// Instagram/LinkedIn : architecture preparee mais non implementee (sections 19-20)
test('les sources instagram et linkedin sont preparees mais leverent une erreur explicite (non implementees)', () => {
  const instagram = getDiscoverySource('instagram', config);
  assert.equal(instagram.name, 'instagram');
  assert.throws(() => instagram.discoverProspects({}), /pas implementee/i);

  const linkedin = getDiscoverySource('linkedin', config);
  assert.equal(linkedin.name, 'linkedin');
  assert.throws(() => linkedin.discoverProspects({}), /pas implementee/i);
});

test('une source inconnue leve une erreur explicite plutot que de retomber silencieusement sur le mock', () => {
  assert.throws(() => getDiscoverySource('tiktok', config), /inconnue/i);
});
