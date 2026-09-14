#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { loadConfig } from './config.js';
import { createProspect } from './schema/prospect.js';
import { findDuplicate } from './deduplication/index.js';
import { analyzeProspect, formatOutput } from './analysis/index.js';
import { loadProspects, saveProspects, upsertProspect } from './store/prospectStore.js';
import { topProspects } from './pipeline/index.js';

const config = loadConfig();

function cmdAdd(jsonFilePath) {
  const input = JSON.parse(readFileSync(jsonFilePath, 'utf-8'));
  const prospects = loadProspects();
  const candidate = createProspect(input);

  const { match, matchedOn } = findDuplicate(candidate, prospects);
  if (match) {
    const merged = { ...match, ...input, id: match.id, signals: { ...match.signals, ...input.signals } };
    upsertProspect(merged);
    console.log(`Doublon detecte (${matchedOn}). Fiche mise a jour : ${merged.id}`);
    return;
  }

  upsertProspect(candidate);
  console.log(`Prospect cree : ${candidate.id}`);
}

function cmdAnalyze(id, event) {
  const prospects = loadProspects();
  const prospect = prospects.find((p) => p.id === id);
  if (!prospect) {
    console.error(`Prospect introuvable : ${id}`);
    process.exit(1);
  }
  const updated = analyzeProspect(prospect, config, { event });
  upsertProspect(updated);
  console.log(formatOutput(updated, config));
}

function cmdList() {
  const prospects = loadProspects();
  for (const p of prospects) {
    console.log(
      `${p.id}  ${p.prenom} ${p.nom} (${p.entreprise || 'N/A'})  score=${p.score_total ?? 'N/A'}  temp=${p.temperature ?? 'N/A'}  statut=${p.statut_pipeline}`
    );
  }
}

function cmdTop(n) {
  const prospects = loadProspects();
  const top = topProspects(prospects, n);
  top.forEach((p, i) => {
    console.log(`${i + 1}. ${p.prenom} ${p.nom} - score=${p.score_total} temp=${p.temperature} offre=${p.offre_recommandee}`);
  });
}

function cmdShow(id) {
  const prospects = loadProspects();
  const prospect = prospects.find((p) => p.id === id);
  if (!prospect) {
    console.error(`Prospect introuvable : ${id}`);
    process.exit(1);
  }
  console.log(JSON.stringify(prospect, null, 2));
}

const [, , command, ...args] = process.argv;

switch (command) {
  case 'add':
    cmdAdd(args[0]);
    break;
  case 'analyze':
    cmdAnalyze(args[0], args[1]);
    break;
  case 'list':
    cmdList();
    break;
  case 'top':
    cmdTop(args[0] ? parseInt(args[0], 10) : 10);
    break;
  case 'show':
    cmdShow(args[0]);
    break;
  default:
    console.log(`Usage:
  node src/cli.js add <fichier.json>
  node src/cli.js analyze <id> [evenement]
  node src/cli.js list
  node src/cli.js top [n]
  node src/cli.js show <id>`);
}
