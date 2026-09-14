import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeProspect, formatOutput } from '../../src/analysis/index.js';
import { config, buildProspect } from '../fixtures.js';

// Test A : Coach etabli + forte croissance + recrutement + surcharge -> HOT
test('Test A - coach etabli + croissance + recrutement + surcharge -> HOT', () => {
  const prospect = buildProspect(
    { prenom: 'Alec', nom: 'Test', entreprise: 'Coaching A', pays: 'France' },
    {
      fit: { coach_business_entrepreneuriat: true, activite_etablie: true, marche_francophone: true },
      maturite: {
        offre_commercialisee: true,
        clients_audience_etablis: true,
        croissance_visible: true,
        delegation_equipe_prestataires: true
      },
      probleme: { manque_de_temps: true, operations: true, besoin_delegation: true, experience_client: true },
      intention: { recrutement: true, delegation_explicitement_recherchee: true },
      contexte: { forte_croissance: true }
    }
  );

  const result = analyzeProspect(prospect, config, { event: 'Test A' });
  assert.equal(result.temperature, 'HOT');
  assert.ok(result.score_total >= 80);
  assert.equal(result.action_recommandee, 'CONVERSATION');
});

// Test B : Coach etabli + excellente cible + activite reguliere mais AUCUN signal d'intention -> WARM, pas HOT
test('Test B - excellent fit sans signal d\'intention -> WARM (jamais HOT)', () => {
  const prospect = buildProspect(
    { prenom: 'Julien', nom: 'Test', entreprise: 'Coaching B' },
    {
      fit: { coach_business_entrepreneuriat: true, activite_etablie: true, marche_francophone: true },
      maturite: {
        offre_commercialisee: true,
        clients_audience_etablis: true,
        croissance_visible: true,
        delegation_equipe_prestataires: true
      },
      probleme: {
        manque_de_temps: true,
        communication: true,
        organisation: true,
        operations: true,
        experience_client: true,
        besoin_delegation: true
      }
      // intention : volontairement vide
    }
  );

  const result = analyzeProspect(prospect, config, { event: 'Test B' });
  assert.ok(result.score_total >= 80, 'le score doit depasser le seuil HOT pour que le test soit pertinent');
  assert.equal(result.temperature, 'WARM');
  assert.equal(result.action_recommandee, 'WARM_UP');
});

// Test C : Debutant + petite audience + aucune offre claire -> IGNORE
test('Test C - debutant sans offre -> IGNORE', () => {
  const prospect = buildProspect(
    { prenom: 'Nouveau', nom: 'Test', entreprise: 'N/A' },
    {
      exclusion: { debutant: true, aucune_offre: true }
    }
  );

  const result = analyzeProspect(prospect, config, { event: 'Test C' });
  assert.equal(result.temperature, 'IGNORE');
  assert.equal(result.action_recommandee, 'IGNORE');
  assert.equal(result.score_total, null, 'aucun score ne doit etre invente pour un prospect exclu');
});

// Test D : Coach etabli + expertise forte + presence LinkedIn irreguliere + manque de temps -> VISIBILITE
test('Test D - manque de temps + communication -> offre VISIBILITE', () => {
  const prospect = buildProspect(
    { prenom: 'Amandine', nom: 'Test', entreprise: 'Coaching D' },
    {
      fit: { coach_business_entrepreneuriat: true, activite_etablie: true, marche_francophone: true },
      maturite: { offre_commercialisee: true, clients_audience_etablis: true },
      probleme: { manque_de_temps: true, communication: true }
    }
  );

  const result = analyzeProspect(prospect, config, { event: 'Test D' });
  assert.equal(result.offre_recommandee, 'VISIBILITE');
});

// Test E : Coach etabli + problemes suivi client + organisation + relances -> SERENITE
test('Test E - organisation + experience_client -> offre SERENITE', () => {
  const prospect = buildProspect(
    { prenom: 'Sophie', nom: 'Test', entreprise: 'Coaching E' },
    {
      fit: { coach_business_entrepreneuriat: true, activite_etablie: true, marche_francophone: true },
      maturite: { offre_commercialisee: true, clients_audience_etablis: true },
      probleme: { organisation: true, experience_client: true, besoin_delegation: true }
    }
  );

  const result = analyzeProspect(prospect, config, { event: 'Test E' });
  assert.equal(result.offre_recommandee, 'SERENITE');
});

// Test F : Coach etabli + plusieurs offres + equipe + problemes communication/organisation/client -> LIBERTE
test('Test F - problemes multiples + equipe/plusieurs offres -> offre LIBERTE', () => {
  const prospect = buildProspect(
    { prenom: 'Marc', nom: 'Test', entreprise: 'Coaching F' },
    {
      fit: { coach_business_entrepreneuriat: true, activite_etablie: true, marche_francophone: true },
      maturite: { offre_commercialisee: true, clients_audience_etablis: true, croissance_visible: true },
      probleme: { communication: true, organisation: true, experience_client: true },
      contexte: { plusieurs_offres: true, equipe_ou_prestataires: true }
    }
  );

  const result = analyzeProspect(prospect, config, { event: 'Test F' });
  assert.equal(result.offre_recommandee, 'LIBERTE');
});

// Test G : informations insuffisantes -> ne rien inventer
test('Test G - informations insuffisantes -> IGNORE, pas d\'invention de donnees', () => {
  const prospect = buildProspect(
    { prenom: 'Inconnu', nom: 'Test' },
    { exclusion: { informations_insuffisantes: true } }
  );

  const result = analyzeProspect(prospect, config, { event: 'Test G' });
  assert.equal(result.temperature, 'IGNORE');
  assert.equal(result.score_total, null);
  assert.match(result.justification, /Informations insuffisantes/);
});

test('formatOutput produit une sortie textuelle sans lever d\'exception', () => {
  const prospect = buildProspect(
    { prenom: 'Test', nom: 'Sortie', activite: 'Coach business' },
    { fit: { coach_business_entrepreneuriat: true } }
  );
  const analyzed = analyzeProspect(prospect, config);
  const text = formatOutput(analyzed, config);
  assert.match(text, /Score :/);
  assert.match(text, /Temperature :/);
  assert.match(text, /Offre recommandee :/);
});

test('historique du score et de la temperature evolue avec de nouveaux signaux', () => {
  // Etape 1 : aucun signal -> score 0 -> COLD
  let prospect = buildProspect({ prenom: 'Evo', nom: 'Lution' }, {});
  prospect = analyzeProspect(prospect, config, { event: 'Analyse initiale' });
  assert.equal(prospect.historique_score.length, 1);
  assert.equal(prospect.score_total, 0);
  assert.equal(prospect.temperature, 'COLD');

  // Etape 2 : FIT complet (30) + 3 criteres MATURITE (15) + 3 criteres PROBLEME (15) = 60 -> WARM
  prospect.signals.fit.coach_business_entrepreneuriat = true;
  prospect.signals.fit.activite_etablie = true;
  prospect.signals.fit.marche_francophone = true;
  prospect.signals.maturite.offre_commercialisee = true;
  prospect.signals.maturite.clients_audience_etablis = true;
  prospect.signals.maturite.croissance_visible = true;
  prospect.signals.probleme.organisation = true;
  prospect.signals.probleme.experience_client = true;
  prospect.signals.probleme.besoin_delegation = true;
  prospect = analyzeProspect(prospect, config, { event: 'Nouveaux signaux detectes' });
  assert.equal(prospect.score_total, 60);
  assert.equal(prospect.temperature, 'WARM');
  assert.equal(prospect.historique_temperature.length, 2);

  // Etape 3 : +5 (delegation_equipe_prestataires) +15 (3 signaux d'intention) = 80 -> HOT
  prospect.signals.maturite.delegation_equipe_prestataires = true;
  prospect.signals.intention.recherche_aide_prestataire = true;
  prospect.signals.intention.delegation_explicitement_recherchee = true;
  prospect.signals.intention.croissance_importante_lancement = true;
  prospect = analyzeProspect(prospect, config, { event: "Signal d'intention detecte" });
  assert.equal(prospect.score_total, 80);
  assert.equal(prospect.temperature, 'HOT');
  assert.equal(prospect.historique_temperature.length, 3);
  assert.equal(prospect.historique_temperature[2].evenement, "Signal d'intention detecte");
});
