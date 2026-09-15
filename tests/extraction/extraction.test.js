import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFromText } from '../../src/extraction/index.js';
import { config } from '../fixtures.js';

test("un signal n'est jamais detecte sans preuve litterale dans le texte", () => {
  const result = extractFromText({ text: 'Bonjour, ceci est un texte neutre sans aucun signal particulier.' }, config);
  const allFalse = Object.values(result.signals).every((category) =>
    Object.values(category).every((v) => v === false)
  );
  assert.equal(allFalse, true);
  assert.deepEqual(result.faits_observes, []);
});

test('un signal haute confiance est retenu avec sa preuve exacte', () => {
  const result = extractFromText({ text: 'Je suis coach business depuis 2019. Je recrute actuellement une personne.' }, config);
  assert.equal(result.signals.fit.coach_business_entrepreneuriat, true);
  assert.equal(result.signals.intention.recrutement, true);

  const evidence = result.evidences.find((e) => e.key === 'coach_business_entrepreneuriat');
  assert.equal(evidence.confidence, 'high');
  assert.match(evidence.evidence, /coach business/i);
  assert.ok(result.faits_observes.some((f) => /coach business/i.test(f)));
});

test('un signal de confiance faible ne devient PAS un fait : il reste une hypothese, le booleen n\'est pas force a true', () => {
  // "pour m'aider a" est une regle 'medium' pour recherche_aide_prestataire -> devrait s'appliquer (medium suffit pour cette categorie)
  // on verifie ici le mecanisme low -> hypothese avec un pattern ad hoc
  const customConfig = {
    ...config,
    extraction: {
      ...config.extraction,
      categories: {
        ...config.extraction.categories,
        probleme: {
          ...config.extraction.categories.probleme,
          manque_de_temps: [{ pattern: 'peut-etre\\s+debordee?', confidence: 'low' }]
        }
      }
    }
  };
  const result = extractFromText({ text: "Elle est peut-etre debordee ces temps-ci." }, customConfig);
  assert.equal(result.signals.probleme.manque_de_temps, false, 'un signal low ne doit pas etre force a true');
  assert.ok(result.hypotheses.some((h) => /debordee/i.test(h)), 'le signal faible doit alimenter les hypotheses');
  assert.equal(result.faits_observes.length, 0);
});

test("l'exclusion ne se declenche que sur une confiance haute (jamais sur un signal faible)", () => {
  const result = extractFromText({ text: "Je debute tout juste en tant que coach." }, config);
  assert.equal(result.signals.exclusion.debutant, true);
});

test('le marche francophone est detecte a partir du champ pays (correspondance litterale, pas une interpretation de texte)', () => {
  const result = extractFromText({ text: 'Texte neutre.', pays: 'Belgique' }, config);
  assert.equal(result.signals.fit.marche_francophone, true);
  assert.ok(result.faits_observes.some((f) => /Belgique/.test(f)));
});

test('pays hors catalogue francophone -> signal non invente', () => {
  const result = extractFromText({ text: 'Texte neutre.', pays: 'Allemagne' }, config);
  assert.equal(result.signals.fit.marche_francophone, false);
});

test('texte tres pauvre -> confiance globale FAIBLE et aucune invention', () => {
  const result = extractFromText({ text: 'Coach.' }, config);
  assert.equal(result.niveau_confiance_extraction, 'FAIBLE');
  assert.deepEqual(result.faits_observes, []);
  assert.deepEqual(result.hypotheses, []);
});

test('texte riche avec plusieurs signaux forts -> confiance globale ELEVEE', () => {
  const result = extractFromText(
    {
      text: `Je suis coach business depuis 2019. Je recrute actuellement une personne.
Mon equipe grandit et je suis en forte croissance.`,
      pays: 'France'
    },
    config
  );
  assert.equal(result.niveau_confiance_extraction, 'ELEVE');
});

test('champs_deduits ne contient que du texte reellement present dans le contenu (jamais invente)', () => {
  const result = extractFromText(
    { text: "Je suis coach business depuis 2019. Je propose un programme d'accompagnement." },
    config
  );
  assert.equal(result.champs_deduits.type_prospect, config.signals.labels.coach_business_entrepreneuriat);
  assert.match(result.champs_deduits.activite, /coach business/i);
  assert.match(result.champs_deduits.offre, /programme d'accompagnement/i);
});

test('texte vide -> aucun signal, aucune fabrication, confiance FAIBLE', () => {
  const result = extractFromText({ text: '' }, config);
  assert.deepEqual(result.faits_observes, []);
  assert.equal(result.champs_deduits.activite, null);
  assert.equal(result.niveau_confiance_extraction, 'FAIBLE');
});
