/**
 * Emplacement reserve pour une future source de decouverte LinkedIn
 * (section 20 du brief V3). NON IMPLEMENTEE.
 *
 * `LinkedInDiscovery` devra un jour respecter la meme interface
 * `DiscoverySource` que les autres sources (voir src/discovery/index.js) :
 *
 *   { name: 'linkedin', discoverProspects(criteria) -> { candidates, stats, eliminated } }
 *
 * Contraintes a respecter le jour ou elle sera implementee :
 * - Uniquement via un moyen officiellement autorise (API partenaire, export
 *   autorise par l'utilisateur...), jamais du scraping ni un contournement
 *   des protections de la plateforme.
 * - Aucune automatisation d'action sociale (connexion, message, commentaire,
 *   like, suivi) : cette source ne fait QUE de la decouverte/lecture de
 *   donnees deja autorisees, jamais d'ecriture sur LinkedIn.
 * - Reutiliser src/discovery/web.js#extractCandidate, dedupeCandidates et
 *   preQualifyCandidates plutot que de dupliquer cette logique.
 */
export function discoverProspectsLinkedIn() {
  throw new Error(
    'LinkedInDiscovery n\'est pas implementee (V3 : architecture preparee uniquement, voir src/discovery/linkedin.js). Aucune connexion ni scraping LinkedIn ne sera ajoute sans decision explicite.'
  );
}

export const LinkedInDiscoverySource = {
  name: 'linkedin',
  discoverProspects: discoverProspectsLinkedIn
};
