import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSearchQueries,
  MockWebSearchProvider,
  extractCandidate,
  dedupeCandidates,
  preQualifyCandidate,
  preQualifyCandidates,
  discoverProspectsWeb,
  createWebDiscoverySource
} from '../../src/discovery/web.js';
import { config } from '../fixtures.js';

// Test 2 : recherche mock
test('2 - MockWebSearchProvider renvoie des resultats structures {title,url,snippet,source}', () => {
  const results = MockWebSearchProvider.search('"coach business" France');
  assert.ok(results.length > 0);
  for (const r of results) {
    assert.ok('title' in r && 'url' in r && 'snippet' in r && 'source' in r);
  }
});

test('MockWebSearchProvider ne fait aucun appel reseau (synchrone, instantane)', () => {
  const before = Date.now();
  MockWebSearchProvider.search('"coach business" France');
  assert.ok(Date.now() - before < 20);
});

test('une requete sans correspondance renvoie un tableau vide (jamais invente)', () => {
  const results = MockWebSearchProvider.search('"mot-cle inexistant" Atlantide');
  assert.deepEqual(results, []);
});

// Test 5 : extraction de candidats
test('5 - extractCandidate identifie nom, entreprise et url_linkedin depuis un resultat LinkedIn-like', () => {
  const candidate = extractCandidate(
    { title: 'Alec Mercier - Coach business independant | LinkedIn', url: 'https://www.linkedin.com/in/alec-mercier-mock', snippet: 'Coach business independant chez Alec Mercier Coaching depuis 2018.', source: 'web_search_mock' },
    '"coach business" France'
  );
  assert.equal(candidate.nom, 'Alec Mercier');
  assert.equal(candidate.entreprise, 'Alec Mercier Coaching');
  assert.equal(candidate.url_linkedin, 'https://www.linkedin.com/in/alec-mercier-mock');
  assert.equal(candidate.site, null);
  assert.equal(candidate.requete, '"coach business" France');
});

test("extractCandidate laisse nom a null plutot que d'inventer un nom absent", () => {
  const candidate = extractCandidate({ title: 'Top 10 des meilleurs coachs', url: 'https://blog.example.fr', snippet: 'Classement...', source: 'web_search_mock' }, 'q');
  assert.equal(candidate.nom, null);
});

test('extractCandidate identifie un site personnel (pas LinkedIn) correctement', () => {
  const candidate = extractCandidate({ title: 'Alec Mercier | Site professionnel', url: 'https://alecmerciercoaching.fr', snippet: '...', source: 'web_search_mock' }, 'q');
  assert.equal(candidate.url_linkedin, null);
  assert.equal(candidate.site, 'https://alecmerciercoaching.fr');
});

// Test 3 + 10 : deduplication, y compris entre requetes
test('3/10 - un meme prospect trouve via 3 requetes (meme URL LinkedIn) reste UN candidat', () => {
  const raw = [
    extractCandidate({ title: 'A - Coach | LinkedIn', url: 'https://www.linkedin.com/in/a-mock', snippet: 'chez A Coaching', source: 's' }, 'q1'),
    extractCandidate({ title: 'A - Coach | LinkedIn', url: 'https://www.linkedin.com/in/a-mock/', snippet: 'chez A Coaching', source: 's' }, 'q2'),
    extractCandidate({ title: 'A - Coach | LinkedIn', url: 'https://www.linkedin.com/in/a-mock', snippet: 'chez A Coaching', source: 's' }, 'q3')
  ];
  const deduped = dedupeCandidates(raw);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].sources.length, 3);
});

test('la deduplication fusionne aussi via domaine/nom+entreprise quand les URL different (LinkedIn vs site perso)', () => {
  const raw = [
    extractCandidate({ title: 'Marie Dupont - Coach | LinkedIn', url: 'https://www.linkedin.com/in/marie-mock', snippet: 'chez Marie Dupont Coaching', source: 's' }, 'q1'),
    extractCandidate({ title: 'Marie Dupont | Site professionnel', url: 'https://marie-dupont-coaching.fr', snippet: 'chez Marie Dupont Coaching', source: 's' }, 'q2')
  ];
  const deduped = dedupeCandidates(raw);
  assert.equal(deduped.length, 1, 'meme nom + meme entreprise -> fusion malgre des URL differentes');
});

test('deux prospects distincts (nom different) ne sont jamais fusionnes', () => {
  const raw = [
    extractCandidate({ title: 'Marie Dupont - Coach | LinkedIn', url: 'https://www.linkedin.com/in/marie-mock', snippet: 'chez Marie Dupont Coaching', source: 's' }, 'q1'),
    extractCandidate({ title: 'Bruno Petit - Coach | LinkedIn', url: 'https://www.linkedin.com/in/bruno-mock', snippet: 'chez Bruno Petit Coaching', source: 's' }, 'q2')
  ];
  assert.equal(dedupeCandidates(raw).length, 2);
});

// Test 12 : conservation des sources
test('12 - le candidat fusionne conserve requete/source/date pour chaque occurrence', () => {
  const raw = [
    extractCandidate({ title: 'A - Coach | LinkedIn', url: 'https://www.linkedin.com/in/a-mock', snippet: '...', source: 'web_search_mock' }, '"coach business" France'),
    extractCandidate({ title: 'A - Coach | LinkedIn', url: 'https://www.linkedin.com/in/a-mock', snippet: '...', source: 'web_search_mock' }, '"coach dirigeants" France')
  ];
  const [merged] = dedupeCandidates(raw);
  assert.deepEqual(
    merged.sources.map((s) => s.requete),
    ['"coach business" France', '"coach dirigeants" France']
  );
  assert.ok(merged.premiere_decouverte);
  assert.ok(merged.derniere_decouverte);
});

test('les preuves textuelles complementaires (snippets differents) sont combinees, pas perdues', () => {
  const raw = [
    extractCandidate({ title: 'Marie Dupont - Coach | LinkedIn', url: 'https://www.linkedin.com/in/marie-mock', snippet: 'Je suis coach depuis 2018 chez Marie Dupont Coaching.', source: 's' }, 'q1'),
    extractCandidate({ title: 'Marie Dupont | Site pro', url: 'https://marie-dupont-coaching.fr', snippet: "J'ai lance mon entreprise chez Marie Dupont Coaching. Mon offre s'adresse aux dirigeants.", source: 's' }, 'q2')
  ];
  const [merged] = dedupeCandidates(raw);
  assert.match(merged.snippet, /coach depuis 2018/);
  assert.match(merged.snippet, /lance mon entreprise/);
});

// Test 4 : pre-qualification
test("4 - un resultat sans nom identifiable est elimine (jamais pour manque d'info seul... ici c'est structurel)", () => {
  const candidate = extractCandidate({ title: 'Boulangerie du Coin - Menu du jour | Site', url: 'https://boulangerie.fr', snippet: 'Pain frais tous les jours.', source: 's' }, 'q');
  const verdict = preQualifyCandidate(candidate, config.discoveryPrequalification, config.statut);
  assert.equal(verdict.keep, false);
});

test("4 - un profil etudiant/debutant manifeste est elimine", () => {
  const candidate = extractCandidate(
    { title: 'Marion Lefevre - Etudiante | LinkedIn', url: 'https://www.linkedin.com/in/marion-mock', snippet: 'Etudiante en formation initiale, je debute tout juste.', source: 's' },
    'q'
  );
  const verdict = preQualifyCandidate(candidate, config.discoveryPrequalification, config.statut);
  assert.equal(verdict.keep, false);
  assert.match(verdict.reason, /etudiant|debutant/i);
});

test('4 - un recrutement salarie manifeste (alternance/CDI) sans vocabulaire independant est elimine', () => {
  const candidate = extractCandidate(
    { title: 'Karim Haddad - Operations | LinkedIn', url: 'https://www.linkedin.com/in/karim-mock', snippet: 'Je recrute un alternant, poste en alternance avec conversion CDI.', source: 's' },
    'q'
  );
  const verdict = preQualifyCandidate(candidate, config.discoveryPrequalification, config.statut);
  assert.equal(verdict.keep, false);
  assert.match(verdict.reason, /salarie/i);
});

test("4 - 'inconnu' != 'hors cible' : un profil avec un nom mais peu d'infos n'est PAS elimine", () => {
  const candidate = extractCandidate(
    { title: 'Julie Berger - Coach dirigeants | LinkedIn', url: 'https://www.linkedin.com/in/julie-mock', snippet: 'Coach business.', source: 's' },
    'q'
  );
  const verdict = preQualifyCandidate(candidate, config.discoveryPrequalification, config.statut);
  assert.equal(verdict.keep, true, "un profil identifiable et pertinent ne doit pas etre elimine pour manque de details");
});

test('4 - un candidat legitime avec vocabulaire independant explicite est conserve malgre une mention de recrutement', () => {
  const candidate = extractCandidate(
    { title: 'Sophie Laurent - Coach | LinkedIn', url: 'https://www.linkedin.com/in/sophie-mock', snippet: "Coach business independante. Je recherche un prestataire freelance pour m'aider.", source: 's' },
    'q'
  );
  const verdict = preQualifyCandidate(candidate, config.discoveryPrequalification, config.statut);
  assert.equal(verdict.keep, true);
});

test('preQualifyCandidates separe correctement les conserves des elimines', () => {
  const candidates = [
    extractCandidate({ title: 'Sophie Laurent - Coach | LinkedIn', url: 'https://www.linkedin.com/in/sophie-mock', snippet: 'Coach business independante depuis 2016.', source: 's' }, 'q'),
    extractCandidate({ title: 'Boulangerie du Coin | Site', url: 'https://boulangerie.fr', snippet: 'Pain frais.', source: 's' }, 'q')
  ];
  const { kept, eliminated } = preQualifyCandidates(candidates, config.discoveryPrequalification, config.statut);
  assert.equal(kept.length, 1);
  assert.equal(eliminated.length, 1);
  assert.ok(eliminated[0].raison_elimination);
});

// Pipeline complet de la source web
test('discoverProspectsWeb enchaine requetes -> extraction -> dedup -> pre-qualification et respecte la limite', () => {
  const result = discoverProspectsWeb({ country: 'France', profile_type: 'coach_business', limit: 3 }, { config });
  assert.ok(result.candidates.length <= 3);
  assert.ok(result.stats.requetes > 0);
  assert.ok(result.stats.resultats_bruts > 0);
  assert.ok('doublons' in result.stats);
  assert.ok('hors_cible' in result.stats);
  assert.ok(Array.isArray(result.eliminated));
});

test('createWebDiscoverySource respecte l\'interface DiscoverySource commune', () => {
  const source = createWebDiscoverySource(config);
  assert.equal(source.name, 'web');
  const result = source.discoverProspects({ country: 'France', profile_type: 'coach_business', limit: 5 });
  assert.ok(Array.isArray(result.candidates));
  assert.ok(result.stats);
});
