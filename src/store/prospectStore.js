import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = path.join(__dirname, '..', '..', 'data', 'prospects.json');

export function loadProspects(filePath = DEFAULT_PATH) {
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

export function saveProspects(prospects, filePath = DEFAULT_PATH) {
  writeFileSync(filePath, JSON.stringify(prospects, null, 2) + '\n', 'utf-8');
}

export function upsertProspect(prospect, filePath = DEFAULT_PATH) {
  const prospects = loadProspects(filePath);
  const index = prospects.findIndex((p) => p.id === prospect.id);
  if (index >= 0) {
    prospects[index] = prospect;
  } else {
    prospects.push(prospect);
  }
  saveProspects(prospects, filePath);
  return prospect;
}
