import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = path.join(__dirname, '..', 'config');

function loadJson(name) {
  const filePath = path.join(CONFIG_DIR, name);
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

export function loadConfig() {
  return {
    icp: loadJson('icp.json'),
    scoring: loadJson('scoring.json'),
    offers: loadJson('offers.json'),
    signals: loadJson('signals.json'),
    thresholds: loadJson('thresholds.json'),
    pipeline: loadJson('pipeline.json')
  };
}
