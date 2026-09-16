import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSemantic } from '../../src/semantic-analysis/index.js';
import { config } from '../fixtures.js';

// Test 1 : coach independant etabli
test('1 - coach independant etabli -> ICP_PRINCIPAL, activite propre confirmee', () => {
  const result = analyzeSemantic(
    {
      pays: 'France',
      text: `Coach business independant depuis 2018. J'accompagne les entrepreneurs qui veulent structurer leur croissance.
Mon programme d'accompagnement dure 6 mois. Mes clients ont deja genere plus de 2 millions d'euros de chiffre d'affaires cumule.`
    },
    config
  );
  assert.equal(result.icp_assessment.qualification, 'ICP_PRINCIPAL');
  assert.equal(result.context.activite_propre, 'CONFIRMEE');
  assert.equal(result.context.statut_professionnel, 'coach_independant');
  assert.equal(result.v1_signals.fit.coach_business_entrepreneuriat, true);
});

// Test 2 : coach etabli sans intention
test('2 - coach etabli sans intention -> ICP_PRINCIPAL mais aucun signal d\'intention retenu', () => {
  const result = analyzeSemantic(
    {
      pays: 'France',
      text: `Coach business independante. J'accompagne les dirigeants de PME depuis 12 ans.
Mon accompagnement se fait sur 9 mois. Ma communaute est en pleine croissance, 12000 abonnes.`
    },
    config
  );
  assert.equal(result.icp_assessment.qualification, 'ICP_PRINCIPAL');
  const intentionSignals = result.signals.filter((s) => s.name && result.v1_signals.intention);
  assert.equal(Object.values(result.v1_signals.intention).some(Boolean), false);
});

// Test 3 : coach avec besoin explicite
test("3 - coach avec besoin explicite (bras droit freelance) -> intention retenue, activite propre confirmee", () => {
  const result = analyzeSemantic(
    {
      pays: 'France',
      text: `Coach business etabli depuis 2015. J'accompagne des dirigeants. Mon offre s'adresse aux dirigeants de PME.
Je cherche un freelance pour m'aider sur mon operationnel, une vraie recherche de bras droit externe.`
    },
    config
  );
  assert.equal(result.v1_signals.intention.recherche_aide_prestataire, true);
  const evidence = result.signals.find((s) => s.name === config.signals.labels.recherche_aide_prestataire);
  assert.ok(evidence);
  assert.equal(evidence.context, 'freelance_prestataire');
});

// Test 4 : formateur independant
test('4 - formateur independant avec activite propre -> ICP_SECONDAIRE', () => {
  const result = analyzeSemantic(
    {
      pays: 'Belgique',
      text: `Formateur independant depuis 8 ans. Mon offre de formation en leadership s'adresse aux managers.
J'ai lance mon programme il y a 3 ans, mes clients me recommandent regulierement.`
    },
    config
  );
  assert.equal(result.icp_assessment.qualification, 'ICP_SECONDAIRE');
  assert.equal(result.context.statut_professionnel, 'formateur_independant');
});

// Test 5 : formateur salarie
test("5 - formateur salarie chez un organisme -> HORS_ICP (jamais suppose independant)", () => {
  const result = analyzeSemantic(
    {
      pays: 'France',
      text: `Formatrice chez AFTRAL depuis 5 ans. J'accompagne les equipes pedagogiques du secteur transport.`
    },
    config
  );
  assert.equal(result.icp_assessment.qualification, 'HORS_ICP');
  assert.equal(result.v1_signals.exclusion.hors_cible, true);
});

// Test 6 : salarie qui recrute
test('6 - salarie qui recrute (alternance interne) -> HORS_ICP, recrutement non retenu comme opportunite', () => {
  const result = analyzeSemantic(
    {
      pays: 'France',
      text: `Operations chez Le Cercle Ops. Je recrute un alternant pour rejoindre mon equipe, poste en alternance avec conversion CDI a 24 mois.`
    },
    config
  );
  assert.equal(result.icp_assessment.qualification, 'HORS_ICP');
  assert.equal(result.v1_signals.intention.recrutement, false);
  assert.ok(result.hypotheses.some((h) => /recrutement salarie interne/i.test(h)));
});

// Test 7 : recrutement interne (contexte explicitement tague, independamment de l'ICP)
test('7 - le contexte "recrutement" est tague salarie_interne quand alternance/CDI est mentionne', () => {
  const result = analyzeSemantic(
    {
      pays: 'France',
      text: `Coach business etabli. J'accompagne des entrepreneurs. Je recrute un alternant pour mon equipe, poste en alternance.`
    },
    config
  );
  const recrutementSignal = result.signals.find((s) => s.name === config.signals.labels.recrutement);
  assert.ok(recrutementSignal);
  assert.equal(recrutementSignal.context, 'salarie_interne');
  // Meme avec un excellent FIT par ailleurs, ce recrutement precis ne doit pas compter comme signal d'intention retenu
  assert.equal(result.v1_signals.intention.recrutement, false);
});

// Test 8 : recherche freelance
test('8 - recherche de freelance/bras droit externe -> contexte freelance_prestataire, signal retenu', () => {
  const result = analyzeSemantic(
    { pays: 'France', text: `Coach business etabli depuis 2015. J'accompagne des dirigeants.
Je cherche un freelance pour m'aider sur mon operationnel, une vraie recherche de bras droit externe.` },
    config
  );
  assert.equal(result.v1_signals.intention.recherche_aide_prestataire, true);
});

// Test 9 : probleme des clients != probleme du prospect
test("9 - 'mes clients ont une organisation chaotique' ne doit jamais devenir le probleme du prospect", () => {
  const result = analyzeSemantic(
    {
      pays: 'France',
      text: `Coach business depuis 2019. J'accompagne des entrepreneurs.
Mes clients ont souvent une organisation completement chaotique avant de venir me voir.`
    },
    config
  );
  assert.equal(result.v1_signals.probleme.organisation, false, "le signal ne doit pas etre attribue au prospect");
  assert.ok(result.hypotheses.some((h) => /concerne les clients du prospect, pas le prospect lui-meme/i.test(h)));
});

// Test 9bis : l'exception "suivi de mes clients" reste bien un probleme DU PROSPECT (sa propre charge)
test('9bis - "le suivi de mes clients me prend du temps" reste un probleme du prospect (exception du garde-fou)', () => {
  const result = analyzeSemantic(
    {
      pays: 'France',
      text: `Coach business depuis 2019. J'accompagne des entrepreneurs.
Le suivi de mes clients me prend enormement de temps chaque semaine.`
    },
    config
  );
  assert.equal(result.v1_signals.probleme.experience_client, true);
});

// Test 12 : contexte ambigu
test("12 - 'je recrute mon bras droit' seul, sans qualificatif -> contexte non determine, confiance reduite", () => {
  const result = analyzeSemantic(
    {
      pays: 'France',
      text: `Coach business etabli depuis 2016. J'accompagne des entrepreneurs.
Je recrute mon bras droit, je prends mon temps pour trouver la bonne personne.`
    },
    config
  );
  const recherche = result.signals.find((s) => s.name === config.signals.labels.recherche_aide_prestataire || s.name === config.signals.labels.recrutement);
  assert.ok(recherche);
  assert.equal(recherche.context, 'non_determine');
});

// Test 13 : activite propre confirmee
test('13 - activite propre confirmee via des preuves explicites (entreprise, offre, clients personnels)', () => {
  const result = analyzeSemantic(
    {
      pays: 'France',
      text: `Coach business. J'ai lance mon entreprise en 2020. Mon offre s'adresse aux dirigeants. Mes clients personnels temoignent regulierement.`
    },
    config
  );
  assert.equal(result.context.activite_propre, 'CONFIRMEE');
  assert.equal(result.icp_assessment.qualification, 'ICP_PRINCIPAL');
});

// Test 14 : activite propre non demontree
test('14 - un simple titre de poste salarie ne demontre jamais une activite propre', () => {
  const result = analyzeSemantic(
    {
      pays: 'France',
      text: `Coach business chez une grande entreprise. Poste salarie en CDI au sein de l'equipe.`
    },
    config
  );
  assert.equal(result.context.activite_propre, 'NON_DEMONTREE');
  assert.notEqual(result.icp_assessment.qualification, 'ICP_PRINCIPAL');
});

test('un signal jamais invente : texte sans aucune preuve -> A_VERIFIER, jamais HORS_ICP ni ICP confirme', () => {
  const result = analyzeSemantic({ pays: '', text: 'Bonjour a tous, belle journee.' }, config);
  assert.equal(result.icp_assessment.qualification, 'A_VERIFIER');
  assert.deepEqual(result.facts, []);
});
