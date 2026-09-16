/**
 * Abstraction pour une future couche d'analyse par modele de langage
 * (section 22 du brief V2). Aujourd'hui : implementation MOCK uniquement,
 * aucune dependance externe, AUCUNE cle API dans le repo, aucun appel
 * reseau. Elle existe pour que le reste du pipeline (semantic-analysis,
 * opportunity, priority) puisse un jour consommer une analyse plus riche
 * sans que son code appelant change.
 *
 * Contrat attendu d'une future implementation reelle : recevoir le texte
 * brut et renvoyer une structure compatible avec celle de
 * src/semantic-analysis#analyzeSemantic (facts/hypotheses/signals/evidence/
 * context/confidence/icp_assessment/opportunity_assessment), pour rester
 * interchangeable avec la couche regex existante plutot que de la remplacer
 * brutalement.
 */

/**
 * Implementation MOCK : ne fait qu'indiquer qu'aucune analyse IA n'a ete
 * executee. Ne jamais inventer de resultat ici - le mock renvoie null pour
 * que l'appelant continue avec l'analyse par regles (source de verite
 * actuelle), jamais un faux resultat qui aurait l'air reel.
 */
export async function analyzeWithAI(text, { provider = 'mock' } = {}) {
  if (provider !== 'mock') {
    throw new Error(
      `Provider IA "${provider}" non configure. Aucune cle API n'est presente dans ce depot : brancher un provider reel est une decision explicite a prendre plus tard, pas une configuration automatique.`
    );
  }

  return {
    provider: 'mock',
    used: false,
    note: "Aucune analyse IA executee (implementation mock, sans appel reseau). L'analyse par regles (src/semantic-analysis) reste la source utilisee.",
    result: null
  };
}
