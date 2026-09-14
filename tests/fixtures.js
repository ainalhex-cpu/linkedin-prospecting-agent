import { loadConfig } from '../src/config.js';
import { createProspect, emptySignals } from '../src/schema/prospect.js';

export const config = loadConfig();

export function buildProspect(overrides = {}, signalOverrides = {}) {
  const signals = emptySignals();
  for (const category of Object.keys(signalOverrides)) {
    Object.assign(signals[category], signalOverrides[category]);
  }
  return createProspect({ ...overrides, signals });
}
