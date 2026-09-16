import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as api from '../../src/server/api.js';
import { config } from '../fixtures.js';

function tempDataFile() {
  const dir = mkdtempSync(path.join(tmpdir(), 'lpa-v2-'));
  const filePath = path.join(dir, 'prospects.json');
  writeFileSync(filePath, '[]');
  return filePath;
}

// Test 17 : workflow discovery -> analyse -> qualification -> scoring -> priorite
test('17 - le workflow complet discover->analyze->qualify->score->prioritize->save fonctionne de bout en bout', () => {
  const filePath = tempDataFile();
  const result = api.runProspectingWorkflow({ country: 'France', limit: 10 }, config, filePath);

  assert.ok(result.stats.trouves > 0);
  assert.equal(result.stats.analyses, result.stats.trouves);
  assert.equal(result.stats.nouveaux, result.stats.trouves, 'premiere execution : tout doit etre nouveau');
  assert.equal(result.stats.doublons, 0);

  // Chaque prospect analyse porte bien les champs V2 en plus des champs V1 (moteur existant, inchange)
  for (const p of result.prospects) {
    assert.ok('temperature' in p, 'le champ V1 temperature doit etre present (moteur existant, source de verite)');
    assert.ok('icp_assessment' in p);
    assert.ok('priorite' in p);
  }

  const stored = api.listProspects(filePath);
  assert.equal(stored.length, result.stats.trouves);
});

// Test 15 : doublon
test('15 - relancer le workflow ne cree aucun doublon (meme prenom/nom/entreprise reconnu)', () => {
  const filePath = tempDataFile();
  const first = api.runProspectingWorkflow({ country: 'France', limit: 10 }, config, filePath);
  const second = api.runProspectingWorkflow({ country: 'France', limit: 10 }, config, filePath);

  assert.equal(second.stats.nouveaux, 0, 'la deuxieme execution ne doit trouver aucun nouveau prospect');
  assert.equal(second.stats.doublons, first.stats.trouves);
  assert.equal(api.listProspects(filePath).length, first.stats.trouves, 'aucun doublon ne doit etre cree en base');
});

test('runProspectingWorkflow respecte le filtre par type de discovery', () => {
  const filePath = tempDataFile();
  const result = api.runProspectingWorkflow({ type: 'formateur_salarie', limit: 10 }, config, filePath);
  assert.equal(result.stats.trouves, 1);
  assert.equal(result.prospects[0].icp_assessment.qualification, 'HORS_ICP');
  assert.equal(result.prospects[0].temperature, 'IGNORE');
});

test('analyzeProspectV2 : le moteur existant (score/temperature) reste la source de verite, la V2 n\'ajoute que des champs supplementaires', () => {
  const filePath = tempDataFile();
  const result = api.analyzeProspectV2(
    {
      prenom: 'Alec',
      nom: 'V2Test',
      entreprise: 'Alec Coaching',
      pays: 'France',
      texte_brut: `Coach business independant depuis 2018. J'accompagne les entrepreneurs.
Mon programme d'accompagnement dure 6 mois. Mes clients ont deja genere plus de 2 millions d'euros.
Je recrute actuellement un freelance pour m'aider a deleguer une partie de mon activite, je n'ai plus le temps de tout gerer moi-meme.`
    },
    config,
    filePath
  );

  assert.equal(result.prospect.temperature, 'WARM');
  assert.equal(result.prospect.priorite, 'A');
  assert.equal(result.prospect.icp_assessment.qualification, 'ICP_PRINCIPAL');
  assert.ok(result.prospect.action_recommandee_v2);
  assert.ok(result.prospect.historique_priorite.length >= 1);
});

test('getBriefingText produit un texte non vide integrant les prospects sauvegardes', () => {
  const filePath = tempDataFile();
  api.runProspectingWorkflow({ country: 'France', limit: 10 }, config, filePath);
  const briefing = api.getBriefingText(config, filePath);
  assert.match(briefing, /PROSPECTION DU JOUR/);
});
