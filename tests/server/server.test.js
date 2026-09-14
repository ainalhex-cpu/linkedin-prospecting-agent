import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// PROSPECTS_FILE doit etre positionne AVANT l'import de prospectStore.js
// (chemin par defaut calcule au chargement du module) pour ne jamais toucher
// a data/prospects.json pendant les tests.
const dir = mkdtempSync(path.join(tmpdir(), 'lpa-server-'));
const dataFile = path.join(dir, 'prospects.json');
writeFileSync(dataFile, '[]');
process.env.PROSPECTS_FILE = dataFile;

const { createServer } = await import('../../src/server/server.js');

const server = createServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

after(() => new Promise((resolve) => server.close(resolve)));

test('GET / sert la page HTML de l\'interface', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /<html/i);
  assert.match(text, /Nouveau prospect/);
});

test('GET /api/config expose le catalogue de signaux existant (pas de liste parallele)', async () => {
  const res = await fetch(`${base}/api/config`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.signals.categories.fit.includes('coach_business_entrepreneuriat'));
  assert.ok(body.scoring.categories.fit.max_points === 30);
});

test('POST /api/analyze cree, analyse et persiste un prospect (scenario HOT)', async () => {
  const payload = {
    prenom: 'Alec',
    nom: 'WebTest',
    entreprise: 'Coaching Web',
    pays: 'France',
    activite: 'Coach business',
    faits_observes: ['A annonce un recrutement pour structurer son equipe'],
    signals: {
      fit: { coach_business_entrepreneuriat: true, activite_etablie: true, marche_francophone: true },
      maturite: {
        offre_commercialisee: true,
        clients_audience_etablis: true,
        croissance_visible: true,
        delegation_equipe_prestataires: true
      },
      probleme: { manque_de_temps: true, operations: true, besoin_delegation: true, experience_client: true },
      intention: { recrutement: true, delegation_explicitement_recherchee: true }
    }
  };

  const res = await fetch(`${base}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.prospect.temperature, 'HOT');
  assert.ok(body.prospect.score_total >= 80);
  assert.equal(body.isDuplicate, false);
  assert.ok(body.prospect.signaux_intention_detectes.length > 0);

  const listRes = await fetch(`${base}/api/prospects`);
  const list = await listRes.json();
  assert.equal(list.length, 1);

  // Re-soumettre le meme prospect (meme prenom+nom+entreprise, pas d'URL) ne doit pas creer de doublon
  const res2 = await fetch(`${base}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body2 = await res2.json();
  assert.equal(body2.isDuplicate, true);

  const listRes2 = await fetch(`${base}/api/prospects`);
  const list2 = await listRes2.json();
  assert.equal(list2.length, 1, 'pas de doublon cree');
  assert.equal(list2[0].historique_score.length, 1, "score inchange -> pas de nouvelle ligne d'historique");

  const ficheRes = await fetch(`${base}/api/prospects/${body.prospect.id}`);
  assert.equal(ficheRes.status, 200);
  const fiche = await ficheRes.json();
  assert.equal(fiche.id, body.prospect.id);
});

test('GET /api/top renvoie les prospects prioritaires', async () => {
  const res = await fetch(`${base}/api/top?n=5`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body));
  assert.ok(body.length >= 1);
});

test('GET /api/prospects/:id sur un id inconnu renvoie 404', async () => {
  const res = await fetch(`${base}/api/prospects/id-inexistant`);
  assert.equal(res.status, 404);
});
