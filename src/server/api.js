import { loadProspects, upsertProspect } from '../store/prospectStore.js';
import { createProspect } from '../schema/prospect.js';
import { findDuplicate } from '../deduplication/index.js';
import { analyzeProspect, formatOutput } from '../analysis/index.js';
import { topProspects } from '../pipeline/index.js';

/**
 * Couche de service partagee entre la CLI et le serveur HTTP. Elle ne
 * contient aucune regle metier : elle enchaine les moteurs existants
 * (schema, deduplication, analysis, pipeline) et le stockage JSON.
 */

export function getUiConfig(config) {
  return {
    signals: config.signals,
    scoring: config.scoring,
    offers: config.offers,
    pipeline: config.pipeline,
    thresholds: config.thresholds,
    icp: config.icp
  };
}

export function listProspects(filePath) {
  return loadProspects(filePath);
}

export function getProspect(id, filePath) {
  const prospects = loadProspects(filePath);
  return prospects.find((p) => p.id === id) || null;
}

function mergeSignalsByCategory(base, overrides = {}) {
  const merged = { ...base };
  for (const category of Object.keys(overrides)) {
    merged[category] = { ...merged[category], ...overrides[category] };
  }
  return merged;
}

/**
 * Cree un prospect, ou met a jour la fiche existante si un doublon est
 * detecte (meme logique de deduplication que la CLI, section 13 du brief).
 */
export function addProspect(input, filePath) {
  const prospects = loadProspects(filePath);
  const candidate = createProspect(input);

  const { match, matchedOn } = findDuplicate(candidate, prospects);
  if (match) {
    const merged = {
      ...match,
      ...input,
      id: match.id,
      signals: mergeSignalsByCategory(match.signals, input.signals)
    };
    upsertProspect(merged, filePath);
    return { prospect: merged, isDuplicate: true, matchedOn };
  }

  upsertProspect(candidate, filePath);
  return { prospect: candidate, isDuplicate: false, matchedOn: null };
}

export function analyzeExisting(id, config, event, filePath) {
  const prospects = loadProspects(filePath);
  const prospect = prospects.find((p) => p.id === id);
  if (!prospect) return null;
  const updated = analyzeProspect(prospect, config, { event });
  upsertProspect(updated, filePath);
  return { prospect: updated, output: formatOutput(updated, config) };
}

/**
 * Point d'entree utilise par le formulaire "Nouveau prospect" de
 * l'interface : ajoute (ou met a jour si doublon) puis lance l'analyse en
 * une seule etape.
 */
export function addAndAnalyze(input, config, filePath) {
  const { prospect, isDuplicate, matchedOn } = addProspect(input, filePath);
  const event = input.event || (isDuplicate ? 'Mise a jour via interface' : 'Analyse initiale via interface');
  const result = analyzeExisting(prospect.id, config, event, filePath);
  return { ...result, isDuplicate, matchedOn };
}

export function topProspectsList(n, filePath) {
  const prospects = loadProspects(filePath);
  return topProspects(prospects, n);
}
