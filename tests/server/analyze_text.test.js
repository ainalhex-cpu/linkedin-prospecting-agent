import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as api from '../../src/server/api.js';
import { config } from '../fixtures.js';

function tempDataFile() {
  const dir = mkdtempSync(path.join(tmpdir(), 'lpa-analyze-text-'));
  const filePath = path.join(dir, 'prospects.json');
  writeFileSync(filePath, '[]');
  return filePath;
}

// Les 7 scenarios du cahier des charges V1.1 : le texte brut doit produire,
// via extraction + moteur EXISTANT (aucune regle de scoring dupliquee), les
// memes categories de resultat que les tests A-G du moteur en V1.

test('Test 1 - coach etabli qui recrute et parle de surcharge -> HOT via le moteur existant', () => {
  const filePath = tempDataFile();
  const result = api.analyzeRawText(
    {
      prenom: 'Alec',
      nom: 'Texte1',
      entreprise: 'Coaching Texte',
      pays: 'France',
      texte_brut: `Je suis coach business depuis 2019. J'accompagne des entrepreneurs pour developper leur activite.
Je propose un programme d'accompagnement sur plusieurs mois.
Mes clients me suivent depuis plusieurs annees et ma communaute grandit vite, en forte croissance.
Je recrute actuellement une personne pour m'aider a structurer mon equipe.
Je suis en surcharge, je n'ai plus le temps de tout gerer moi-meme.
Le suivi de mes clients et les relances me prennent enormement de temps.
J'ai besoin de deleguer une vraie partie de mon activite.`
    },
    config,
    filePath
  );

  assert.equal(result.prospect.temperature, 'HOT');
  assert.ok(result.prospect.score_total >= 80);
  assert.equal(result.prospect.action_recommandee, 'CONVERSATION');
  assert.ok(result.extraction.evidences.length > 0);
  assert.equal(result.extraction.niveau_confiance_extraction, 'ELEVE');
  // Le signal d'intention doit etre trace jusqu'a sa preuve textuelle ("Pourquoi ?")
  const recrutementEvidence = result.extraction.evidences.find((e) => e.key === 'recrutement');
  assert.ok(recrutementEvidence);
  assert.match(recrutementEvidence.evidence, /je recrute/i);
  assert.match(recrutementEvidence.impact, /\+\d+ points INTENTION/);
});

test('Test 2 - coach etabli excellent fit mais sans intention -> WARM maximum (jamais HOT)', () => {
  const filePath = tempDataFile();
  const result = api.analyzeRawText(
    {
      prenom: 'Julien',
      nom: 'Texte2',
      entreprise: 'Coaching Texte 2',
      pays: 'France',
      texte_brut: `Je suis coach business depuis 2018. J'accompagne des entrepreneurs.
Je propose un programme d'accompagnement complet.
Mes clients me suivent depuis plusieurs annees et ma communaute est en pleine croissance.
Le suivi de mes clients et les relances me prennent enormement de temps.
Mon organisation est completement chaotique.`
    },
    config,
    filePath
  );

  assert.equal(result.prospect.temperature, 'WARM');
  assert.notEqual(result.prospect.temperature, 'HOT');
});

test('Test 3 - debutant -> IGNORE via la qualification existante', () => {
  const filePath = tempDataFile();
  const result = api.analyzeRawText(
    {
      prenom: 'Nouveau',
      nom: 'Texte3',
      entreprise: 'N/A',
      pays: 'France',
      texte_brut: "Je debute tout juste en tant que coach. Je n'ai pas encore de programme ni de clients."
    },
    config,
    filePath
  );

  assert.equal(result.prospect.temperature, 'IGNORE');
  assert.equal(result.prospect.score_total, null, 'aucun score invente pour un prospect exclu');
});

test('Test 4 - manque de temps pour le contenu -> signal + offre VISIBILITE', () => {
  const filePath = tempDataFile();
  const result = api.analyzeRawText(
    {
      prenom: 'Amandine',
      nom: 'Texte4',
      entreprise: 'Coaching Texte 4',
      pays: 'France',
      texte_brut: `Je suis coach business depuis 2017. J'accompagne des entrepreneurs.
Je propose un programme d'accompagnement.
Mes clients me suivent depuis plusieurs annees.
Je ne poste plus regulierement et je n'ai plus le temps de creer du contenu.`
    },
    config,
    filePath
  );

  assert.equal(result.prospect.signals.probleme.communication, true);
  assert.equal(result.prospect.offre_recommandee, 'VISIBILITE');
});

test('Test 5 - suivi client, relances, organisation -> offre SERENITE', () => {
  const filePath = tempDataFile();
  const result = api.analyzeRawText(
    {
      prenom: 'Sophie',
      nom: 'Texte5',
      entreprise: 'Coaching Texte 5',
      pays: 'France',
      texte_brut: `Je suis coach business depuis 2016. J'accompagne des entrepreneurs.
Je propose un programme d'accompagnement.
Mes clients me suivent depuis plusieurs annees.
Le suivi de mes clients et les relances me prennent enormement de temps, mon organisation est completement chaotique.`
    },
    config,
    filePath
  );

  assert.equal(result.prospect.offre_recommandee, 'SERENITE');
});

test('Test 6 - plusieurs problemes + croissance + equipe -> offre LIBERTE', () => {
  const filePath = tempDataFile();
  const result = api.analyzeRawText(
    {
      prenom: 'Marc',
      nom: 'Texte6',
      entreprise: 'Coaching Texte 6',
      pays: 'France',
      texte_brut: `Je suis coach business depuis 2015. J'accompagne des entrepreneurs.
Je propose plusieurs programmes d'accompagnement en parallele.
Mes clients me suivent depuis plusieurs annees et je suis en pleine croissance.
Je ne poste plus regulierement, mon organisation est completement chaotique.
Je travaille avec mon equipe et mes prestataires au quotidien.`
    },
    config,
    filePath
  );

  assert.equal(result.prospect.offre_recommandee, 'LIBERTE');
});

test('Test 7 - texte extremement pauvre -> rien invente, confiance faible, analyse prudente', () => {
  const filePath = tempDataFile();
  const result = api.analyzeRawText(
    { prenom: 'Inconnu', nom: 'Texte7', entreprise: '', pays: '', texte_brut: 'Coach.' },
    config,
    filePath
  );

  assert.equal(result.extraction.niveau_confiance_extraction, 'FAIBLE');
  assert.deepEqual(result.extraction.evidences, []);
  assert.deepEqual(result.prospect.faits_observes, []);
  assert.deepEqual(result.prospect.hypotheses, []);
  assert.notEqual(result.prospect.temperature, 'HOT', 'un texte pauvre ne doit jamais produire un HOT invente');
  assert.equal(result.prospect.score_total, 0);
  assert.equal(result.prospect.temperature, 'COLD');
});

test("l'analyse par texte reutilise le meme moteur que le formulaire manuel (memes scores pour les memes signaux)", () => {
  const filePath = tempDataFile();
  const viaText = api.analyzeRawText(
    {
      prenom: 'Compare',
      nom: 'Texte',
      entreprise: 'X',
      pays: 'France',
      texte_brut: 'Je suis coach business depuis 2019. Je recrute actuellement une personne.'
    },
    config,
    filePath
  );

  const filePath2 = tempDataFile();
  const viaManual = api.addAndAnalyze(
    {
      prenom: 'Compare',
      nom: 'Manuel',
      entreprise: 'X',
      pays: 'France',
      signals: {
        fit: { coach_business_entrepreneuriat: true, activite_etablie: true, marche_francophone: true },
        intention: { recrutement: true }
      }
    },
    config,
    filePath2
  );

  assert.equal(viaText.prospect.score_total, viaManual.prospect.score_total);
  assert.equal(viaText.prospect.temperature, viaManual.prospect.temperature);
});

test('deduplication : analyser deux fois le meme profil (meme nom/entreprise) met a jour la fiche, ne duplique pas', () => {
  const filePath = tempDataFile();
  const payload = {
    prenom: 'Doublon',
    nom: 'Test',
    entreprise: 'Coaching Doublon',
    pays: 'France',
    texte_brut: 'Je suis coach business depuis 2019.'
  };
  api.analyzeRawText(payload, config, filePath);
  const second = api.analyzeRawText(payload, config, filePath);

  assert.equal(second.isDuplicate, true);
  assert.equal(api.listProspects(filePath).length, 1);
});
