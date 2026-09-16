/**
 * Emplacement reserve pour une future source de decouverte Instagram
 * (section 19 du brief V3). NON IMPLEMENTEE.
 *
 * Quand elle sera construite, `InstagramDiscovery` devra respecter la meme
 * interface `DiscoverySource` que les autres sources (voir
 * src/discovery/index.js) :
 *
 *   { name: 'instagram', discoverProspects(criteria) -> { candidates, stats, eliminated } }
 *
 * Contraintes a respecter le jour ou elle sera implementee :
 * - Ne jamais supposer qu'un acces API Instagram est disponible : verifier
 *   explicitement la presence d'identifiants/autorisation avant tout appel.
 * - Ne jamais scraper Instagram (pas de contournement des protections de la
 *   plateforme, pas d'automatisation d'un navigateur pour lire des pages).
 * - Reutiliser src/discovery/web.js#extractCandidate,
 *   dedupeCandidates et preQualifyCandidates plutot que de dupliquer cette
 *   logique.
 */
export function discoverProspectsInstagram() {
  throw new Error(
    'InstagramDiscovery n\'est pas implementee (V3 : architecture preparee uniquement, voir src/discovery/instagram.js).'
  );
}

export const InstagramDiscoverySource = {
  name: 'instagram',
  discoverProspects: discoverProspectsInstagram
};
