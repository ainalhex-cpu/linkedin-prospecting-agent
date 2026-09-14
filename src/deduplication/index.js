/**
 * Moteur de deduplication. Ordre de priorite (section 13) :
 * 1. URL LinkedIn
 * 2. identifiant LinkedIn
 * 3. combinaison prenom + nom + entreprise
 */
export function normalizeUrl(url) {
  if (!url) return '';
  return url
    .trim()
    .toLowerCase()
    .replace(/\/+$/, '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '');
}

function normalizeText(text) {
  return (text || '').trim().toLowerCase();
}

export function findDuplicate(candidate, existingProspects) {
  const candidateUrl = normalizeUrl(candidate.url_linkedin);
  if (candidateUrl) {
    const match = existingProspects.find((p) => normalizeUrl(p.url_linkedin) === candidateUrl);
    if (match) return { match, matchedOn: 'url_linkedin' };
  }

  if (candidate.linkedin_id) {
    const match = existingProspects.find(
      (p) => p.linkedin_id && p.linkedin_id === candidate.linkedin_id
    );
    if (match) return { match, matchedOn: 'linkedin_id' };
  }

  const candidateNom = normalizeText(candidate.nom);
  const candidatePrenom = normalizeText(candidate.prenom);
  const candidateEntreprise = normalizeText(candidate.entreprise);

  if (candidateNom && candidatePrenom && candidateEntreprise) {
    const match = existingProspects.find(
      (p) =>
        normalizeText(p.nom) === candidateNom &&
        normalizeText(p.prenom) === candidatePrenom &&
        normalizeText(p.entreprise) === candidateEntreprise
    );
    if (match) return { match, matchedOn: 'nom_prenom_entreprise' };
  }

  return { match: null, matchedOn: null };
}
