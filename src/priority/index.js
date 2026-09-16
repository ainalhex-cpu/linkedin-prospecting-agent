/**
 * Priorite operationnelle (section 12 du brief V2) : distincte du score
 * /100 et de la temperature. Repond a "sur qui je passe du temps
 * aujourd'hui", pas "qui est le meilleur prospect dans l'absolu".
 *
 * PRIORITE A : excellent ICP (principal) + opportunite forte.
 * PRIORITE B : excellent ICP + opportunite moyenne/faible (signaux
 *              interessants mais intention faible), ou ICP secondaire /
 *              a verifier avec une opportunite forte.
 * PRIORITE C : bon ICP (secondaire) ou statut a verifier, peu de signaux.
 * IGNORE     : hors cible (statut salarie, exclusion V1, etc.).
 */
export function computePriority({ icpQualification, opportunityLevel, temperature }) {
  if (temperature === 'IGNORE' || icpQualification === 'HORS_ICP') {
    return 'IGNORE';
  }

  if (icpQualification === 'ICP_PRINCIPAL') {
    return opportunityLevel === 'FORTE' ? 'A' : 'B';
  }

  if (icpQualification === 'ICP_SECONDAIRE') {
    return opportunityLevel === 'FORTE' ? 'B' : 'C';
  }

  // A_VERIFIER : ICP non confirme. Une opportunite forte merite un coup
  // d'oeil humain (priorite B) plutot que d'etre enterree, mais ne peut
  // jamais atteindre la priorite A sans un FIT confirme.
  return opportunityLevel === 'FORTE' ? 'B' : 'C';
}
