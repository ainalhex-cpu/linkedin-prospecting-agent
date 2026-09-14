import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as api from '../../src/server/api.js';
import { config } from '../fixtures.js';

function tempDataFile() {
  const dir = mkdtempSync(path.join(tmpdir(), 'lpa-api-'));
  const filePath = path.join(dir, 'prospects.json');
  writeFileSync(filePath, '[]');
  return filePath;
}

test("ajout d'un prospect via l'interface cree une fiche", () => {
  const filePath = tempDataFile();
  const { prospect, isDuplicate } = api.addProspect(
    { prenom: 'Marie', nom: 'Dupont', entreprise: 'MD Coaching', pays: 'France' },
    filePath
  );
  assert.equal(isDuplicate, false);
  assert.equal(prospect.prenom, 'Marie');
  assert.equal(api.listProspects(filePath).length, 1);
});

test("l'ajout d'un prospect avec la meme URL LinkedIn met a jour la fiche existante (pas de doublon)", () => {
  const filePath = tempDataFile();
  const first = api.addProspect(
    { prenom: 'Marie', nom: 'Dupont', entreprise: 'MD Coaching', url_linkedin: 'https://www.linkedin.com/in/marie-dupont' },
    filePath
  );
  const second = api.addProspect(
    { prenom: 'Marie', nom: 'Dupont', entreprise: 'MD Coaching', url_linkedin: 'https://linkedin.com/in/marie-dupont', activite: 'Coach business' },
    filePath
  );

  assert.equal(second.isDuplicate, true);
  assert.equal(second.matchedOn, 'url_linkedin');
  assert.equal(second.prospect.id, first.prospect.id);
  assert.equal(api.listProspects(filePath).length, 1, 'aucun doublon ne doit etre cree');
  assert.equal(second.prospect.activite, 'Coach business', 'la fiche existante doit etre mise a jour');
});

test('analyzeExisting calcule le score/temperature/offre et les persiste', () => {
  const filePath = tempDataFile();
  const { prospect } = api.addProspect(
    {
      prenom: 'Alec',
      nom: 'Test',
      entreprise: 'Coaching A',
      signals: {
        fit: { coach_business_entrepreneuriat: true, activite_etablie: true, marche_francophone: true },
        maturite: { offre_commercialisee: true, clients_audience_etablis: true, croissance_visible: true, delegation_equipe_prestataires: true },
        probleme: { manque_de_temps: true, operations: true, besoin_delegation: true, experience_client: true },
        intention: { recrutement: true, delegation_explicitement_recherchee: true }
      }
    },
    filePath
  );

  const result = api.analyzeExisting(prospect.id, config, 'Analyse initiale', filePath);
  assert.equal(result.prospect.temperature, 'HOT');
  assert.ok(result.prospect.score_total >= 80);
  assert.equal(result.prospect.action_recommandee, 'CONVERSATION');
  assert.match(result.output, /Score :/);

  const stored = api.getProspect(prospect.id, filePath);
  assert.equal(stored.temperature, 'HOT', "l'analyse doit etre persistee");
});

test("addAndAnalyze fait tout en une etape (formulaire de l'interface)", () => {
  const filePath = tempDataFile();
  const { prospect } = api.addAndAnalyze(
    {
      prenom: 'Sophie',
      nom: 'Test',
      entreprise: 'Coaching E',
      signals: {
        fit: { coach_business_entrepreneuriat: true, activite_etablie: true, marche_francophone: true },
        maturite: { offre_commercialisee: true, clients_audience_etablis: true },
        probleme: { organisation: true, experience_client: true, besoin_delegation: true }
      }
    },
    config,
    filePath
  );
  assert.equal(prospect.offre_recommandee, 'SERENITE');
  assert.notEqual(prospect.score_total, null);
});

test("l'historique de score n'est pas duplique si le score ne change pas entre deux analyses", () => {
  const filePath = tempDataFile();
  const input = {
    prenom: 'Evo',
    nom: 'Lution',
    entreprise: 'X',
    signals: { probleme: { organisation: true } }
  };
  api.addAndAnalyze(input, config, filePath);
  const second = api.addAndAnalyze(input, config, filePath);

  assert.equal(second.isDuplicate, true, 'le meme prenom/nom/entreprise doit etre reconnu comme doublon');
  assert.equal(api.listProspects(filePath).length, 1);
  assert.equal(second.prospect.historique_score.length, 1, 'score inchange -> pas de nouvelle ligne d\'historique');
});

test('topProspectsList exclut les prospects IGNORE et trie par priorite', () => {
  const filePath = tempDataFile();
  api.addAndAnalyze(
    { prenom: 'Hot', nom: 'One', entreprise: 'A', signals: { exclusion: { debutant: true } } },
    config,
    filePath
  );
  api.addAndAnalyze(
    {
      prenom: 'Bon',
      nom: 'Fit',
      entreprise: 'B',
      signals: { fit: { coach_business_entrepreneuriat: true, activite_etablie: true, marche_francophone: true } }
    },
    config,
    filePath
  );

  const top = api.topProspectsList(10, filePath);
  assert.equal(top.length, 1, 'le prospect exclu ne doit pas apparaitre dans le top');
  assert.equal(top[0].prenom, 'Bon');
});
