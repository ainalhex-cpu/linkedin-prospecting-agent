#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { loadConfig } from './config.js';
import * as api from './server/api.js';

const config = loadConfig();

function cmdAdd(jsonFilePath) {
  const input = JSON.parse(readFileSync(jsonFilePath, 'utf-8'));
  const { prospect, isDuplicate, matchedOn } = api.addProspect(input);
  if (isDuplicate) {
    console.log(`Doublon detecte (${matchedOn}). Fiche mise a jour : ${prospect.id}`);
  } else {
    console.log(`Prospect cree : ${prospect.id}`);
  }
}

function cmdAnalyze(id, event) {
  const result = api.analyzeExisting(id, config, event);
  if (!result) {
    console.error(`Prospect introuvable : ${id}`);
    process.exit(1);
  }
  console.log(result.output);
}

function cmdList() {
  const prospects = api.listProspects();
  for (const p of prospects) {
    console.log(
      `${p.id}  ${p.prenom} ${p.nom} (${p.entreprise || 'N/A'})  score=${p.score_total ?? 'N/A'}  temp=${p.temperature ?? 'N/A'}  statut=${p.statut_pipeline}`
    );
  }
}

function cmdTop(n) {
  const top = api.topProspectsList(n);
  top.forEach((p, i) => {
    console.log(`${i + 1}. ${p.prenom} ${p.nom} - score=${p.score_total} temp=${p.temperature} offre=${p.offre_recommandee}`);
  });
}

function cmdShow(id) {
  const prospect = api.getProspect(id);
  if (!prospect) {
    console.error(`Prospect introuvable : ${id}`);
    process.exit(1);
  }
  console.log(JSON.stringify(prospect, null, 2));
}

async function cmdServe() {
  const { createServer } = await import('./server/server.js');
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4173;
  const server = createServer({ config });
  server.listen(port, () => {
    console.log(`Interface de prospection disponible sur http://localhost:${port}`);
  });
}

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith('--')) {
      flags[args[i].slice(2)] = args[i + 1];
      i += 1;
    }
  }
  return flags;
}

/**
 * Workflow section 16 : DISCOVER -> DEDUPLICATE -> ANALYZE -> QUALIFY ->
 * SCORE -> PRIORITIZE -> SAVE. Usage :
 *   node src/cli.js prospect [--country France] [--type coach_business] [--limit 10]
 */
function cmdProspect(args) {
  const flags = parseFlags(args);
  const result = api.runProspectingWorkflow(
    { country: flags.country, type: flags.type, limit: flags.limit ? parseInt(flags.limit, 10) : 10 },
    config
  );

  console.log('=== Workflow de prospection ===');
  console.log(`Prospects trouves     : ${result.stats.trouves}`);
  console.log(`Nouveaux              : ${result.stats.nouveaux}`);
  console.log(`Doublons mis a jour   : ${result.stats.doublons}`);
  console.log(`Analyses              : ${result.stats.analyses}`);
  console.log(`  HOT   : ${result.stats.HOT}`);
  console.log(`  WARM  : ${result.stats.WARM}`);
  console.log(`  COLD  : ${result.stats.COLD}`);
  console.log(`  IGNORE: ${result.stats.IGNORE}`);
  console.log('\n=== Top priorites ===');
  result.top.forEach((p, i) => {
    console.log(`${i + 1}. ${p.prenom} ${p.nom} - score=${p.score_total} temp=${p.temperature} priorite=${p.priorite || 'N/A'} offre=${p.offre_recommandee}`);
  });
}

function cmdBriefing() {
  console.log(api.getBriefingText(config));
}

/**
 * Section 14 du brief V3 : DISCOVER -> ANALYZE -> QUALIFY -> PRIORITIZE ->
 * SAVE via la source "web" (recherche, aucun scraping) par defaut. Usage :
 *   node src/cli.js discover [--country France] [--type coach_business] [--limit 10] [--source mock|web]
 */
function cmdDiscover(args) {
  const flags = parseFlags(args);
  const result = api.runProspectingWorkflow(
    {
      source: flags.source || 'web',
      country: flags.country,
      market: flags.market,
      profile_type: flags.type,
      limit: flags.limit ? parseInt(flags.limit, 10) : 10
    },
    config
  );

  console.log('# DISCOVERY\n');
  console.log(`Resultats trouves : ${result.stats.trouves}`);
  console.log(`Doublons : ${result.stats.doublons_recherche}`);
  console.log(`Hors cible : ${result.stats.hors_cible_decouverte}`);
  console.log(`Analyses : ${result.stats.analyses}`);
  console.log(`A : ${result.stats.priorite.A}`);
  console.log(`B : ${result.stats.priorite.B}`);
  console.log(`C : ${result.stats.priorite.C}`);
  console.log(`IGNORE : ${result.stats.priorite.IGNORE}`);

  console.log('\n## TOP PROSPECTS\n');
  if (result.top.length === 0) {
    console.log('Aucun prospect pertinent pour le moment.');
    return;
  }
  result.top.forEach((p, i) => {
    console.log(`${i + 1}. ${p.prenom} ${p.nom}`);
    console.log(`   Score : ${p.score_total ?? 'N/A'}`);
    console.log(`   Priorite : ${p.priorite || 'N/A'}`);
    console.log(`   Besoin : ${p.probleme_principal || 'Non identifie'}`);
    console.log(`   Offre : ${p.offre_recommandee || 'Non identifiee'}`);
    console.log(`   Pourquoi maintenant : ${p.opportunity_reason || p.justification_action_v2 || p.justification_action || 'Non identifie'}`);
    console.log(`   Source : ${(p.sources && p.sources[0]) || 'Non identifiee'}`);
    console.log('');
  });
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
  case 'serve':
    cmdServe();
    break;
  case 'prospect':
    cmdProspect(args);
    break;
  case 'briefing':
    cmdBriefing();
    break;
  case 'discover':
    cmdDiscover(args);
    break;
  default:
    console.log(`Usage:
  node src/cli.js add <fichier.json>
  node src/cli.js analyze <id> [evenement]
  node src/cli.js list
  node src/cli.js top [n]
  node src/cli.js show <id>
  node src/cli.js serve            (lance l'interface web sur http://localhost:4173)
  node src/cli.js prospect [--country France] [--type coach_business] [--limit 10]
                                    (workflow V2 : source mock -> analyse -> priorite)
  node src/cli.js discover [--country France] [--type coach_business] [--limit 10] [--source mock|web]
                                    (workflow V3 : decouverte web (mock, sans reseau) -> analyse -> priorite)
  node src/cli.js briefing          (briefing quotidien, utilise le dernier pipeline sauvegarde)`);
}
