import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBriefing } from '../../src/briefing/index.js';

function fakeProspect(overrides) {
  return {
    prenom: 'Alec',
    nom: 'Test',
    entreprise: 'Alec Coaching',
    justification_action: 'Score eleve avec intention forte',
    probleme_principal: 'Manque de temps',
    offre_recommandee: 'LIBERTE',
    action_recommandee: 'CONVERSATION',
    priorite: 'A',
    ...overrides
  };
}

test('16 - le briefing contient les 4 sections attendues', () => {
  const briefing = buildBriefing([fakeProspect({})], { date: new Date('2026-09-16') });
  assert.match(briefing, /# PROSPECTION DU JOUR/);
  assert.match(briefing, /A REGARDER EN PRIORITE/);
  assert.match(briefing, /A RECHAUFFER/);
  assert.match(briefing, /A SURVEILLER/);
  assert.match(briefing, /IGNORES/);
});

test('16bis - un prospect priorite A apparait dans la section "a regarder en priorite"', () => {
  const briefing = buildBriefing([fakeProspect({ priorite: 'A' })], {});
  const prioritySection = briefing.split('A RECHAUFFER')[0];
  assert.match(prioritySection, /Alec Test/);
});

test('16ter - les prospects ignores sont comptes avec leurs raisons principales', () => {
  const briefing = buildBriefing(
    [
      fakeProspect({ priorite: 'IGNORE', raisons_exclusion: [{ label: 'Hors cible' }] }),
      fakeProspect({ priorite: 'IGNORE', raisons_exclusion: [{ label: 'Hors cible' }] })
    ],
    {}
  );
  assert.match(briefing, /2 prospect\(s\) ignore\(s\)/);
  assert.match(briefing, /Hors cible \(2\)/);
});

test('16quater - aucun prospect dans une categorie -> message explicite plutot qu\'une section vide', () => {
  const briefing = buildBriefing([], {});
  assert.match(briefing, /Aucun prospect priorite A aujourd'hui/);
});
