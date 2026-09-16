/**
 * Moteur de decouverte (section 1 du brief V3) : expose une interface
 * commune `DiscoverySource` --
 *
 *   { name, discoverProspects(criteria) -> { candidates, stats, eliminated } }
 *
 * -- et permet de choisir la source active (`mock`, `web`, et plus tard
 * `instagram`/`linkedin`, deja preparees mais non implementees) SANS
 * changer le reste du pipeline (analyse semantique, qualification, scoring,
 * priorite restent identiques quelle que soit la source).
 *
 * Retro-compatibilite V2 : `discoverProspects()` reste exporte tel quel
 * (source mock, tableau brut) pour ne rien casser dans le workflow et les
 * tests V2 existants.
 */
import { discoverProspects, MockDiscoverySource } from './mock.js';
import { createWebDiscoverySource } from './web.js';
import { InstagramDiscoverySource } from './instagram.js';
import { LinkedInDiscoverySource } from './linkedin.js';

export { discoverProspects, MOCK_PROSPECTS } from './mock.js';

/**
 * Retourne une DiscoverySource prete a l'emploi pour le nom donne. `config`
 * (voir src/config.js) est requis par les sources qui en ont besoin (web).
 */
export function getDiscoverySource(name = 'mock', config) {
  switch (name) {
    case 'mock':
      return MockDiscoverySource;
    case 'web':
      return createWebDiscoverySource(config);
    case 'instagram':
      return InstagramDiscoverySource;
    case 'linkedin':
      return LinkedInDiscoverySource;
    default:
      throw new Error(`Source de decouverte inconnue : "${name}". Sources disponibles : mock, web (instagram/linkedin preparees, non implementees).`);
  }
}

export const AVAILABLE_DISCOVERY_SOURCES = ['mock', 'web'];
export const PLANNED_DISCOVERY_SOURCES = ['instagram', 'linkedin'];
