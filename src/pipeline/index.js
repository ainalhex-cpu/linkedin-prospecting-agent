/**
 * Gestion du pipeline : statuts valides + priorisation des prospects.
 *
 * Ordre de priorite (section 16) : pertinence ICP (score FIT), maturite,
 * probleme detecte, intention, facilite de prise de contact, recence des
 * signaux. On implemente un tri lexicographique sur ces criteres plutot
 * qu'un simple tri par score_total, pour rester fidele a l'ordre demande.
 */
export function isValidStatut(statut, pipelineConfig) {
  return pipelineConfig.statuts.includes(statut);
}

export function moveStatut(prospect, newStatut, pipelineConfig) {
  if (!isValidStatut(newStatut, pipelineConfig)) {
    throw new Error(`Statut de pipeline invalide: ${newStatut}`);
  }
  return { ...prospect, statut_pipeline: newStatut };
}

function recencyValue(prospect) {
  const date = prospect.derniere_analyse || prospect.date_decouverte;
  return date ? new Date(date).getTime() : 0;
}

export function prioritize(prospects, { excludeStatuts = ['Ignore', 'Perdu'] } = {}) {
  return prospects
    .filter((p) => p.temperature !== 'IGNORE' && !excludeStatuts.includes(p.statut_pipeline))
    .slice()
    .sort((a, b) => {
      const fields = [
        ['score_fit', 'desc'],
        ['score_maturite', 'desc'],
        ['score_probleme', 'desc'],
        ['score_intention', 'desc'],
        ['facilite_contact', 'desc']
      ];
      for (const [field, dir] of fields) {
        const av = a[field] ?? -1;
        const bv = b[field] ?? -1;
        if (av !== bv) return dir === 'desc' ? bv - av : av - bv;
      }
      return recencyValue(b) - recencyValue(a);
    });
}

export function topProspects(prospects, n = 10, options) {
  return prioritize(prospects, options).slice(0, n);
}
