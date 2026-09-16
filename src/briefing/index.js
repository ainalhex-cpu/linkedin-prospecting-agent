/**
 * Genere le briefing quotidien (section 17 du brief V2) : court, oriente
 * action, base sur la priorite operationnelle (src/priority), pas sur le
 * score seul. Pure fonction de formatage : ne recalcule rien.
 */

function formatProspectLine(p) {
  const actionChanged = p.action_recommandee_v2 && p.action_recommandee_v2 !== p.action_recommandee;
  const pourquoi = actionChanged
    ? p.justification_action_v2
    : p.justification_action || p.justification || 'Non identifie';

  const lines = [
    `${p.prenom} ${p.nom}${p.entreprise ? ` (${p.entreprise})` : ''}`,
    `  - Pourquoi : ${pourquoi}`,
    `  - Signal : ${p.probleme_principal || (p.signaux_intention_detectes || [])[0]?.label || 'Non identifie'}`,
    `  - Offre : ${p.offre_recommandee || 'Non identifiee'}`,
    `  - Action : ${p.action_recommandee_v2 || p.action_recommandee || 'Non identifiee'}`
  ];
  return lines.join('\n');
}

export function buildBriefing(prospects, { date = new Date() } = {}) {
  const byPriority = { A: [], B: [], C: [], IGNORE: [] };
  for (const p of prospects) {
    const bucket = byPriority[p.priorite] ? p.priorite : 'IGNORE';
    byPriority[bucket].push(p);
  }

  const dateStr = date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  const lines = [`# PROSPECTION DU JOUR - ${dateStr}`, ''];

  lines.push('## 🔥 A REGARDER EN PRIORITE', '');
  lines.push(byPriority.A.length ? byPriority.A.map(formatProspectLine).join('\n\n') : 'Aucun prospect priorite A aujourd\'hui.', '');

  lines.push('## 🟠 A RECHAUFFER', '');
  lines.push(byPriority.B.length ? byPriority.B.map(formatProspectLine).join('\n\n') : 'Aucun prospect priorite B aujourd\'hui.', '');

  lines.push('## 🔵 A SURVEILLER', '');
  lines.push(byPriority.C.length ? byPriority.C.map(formatProspectLine).join('\n\n') : 'Aucun prospect priorite C aujourd\'hui.', '');

  lines.push('## ❌ IGNORES', '');
  if (byPriority.IGNORE.length) {
    const reasons = {};
    for (const p of byPriority.IGNORE) {
      const reason = (p.raisons_exclusion && p.raisons_exclusion[0]?.label) || p.icp_assessment?.reason || 'Hors cible';
      reasons[reason] = (reasons[reason] || 0) + 1;
    }
    lines.push(`${byPriority.IGNORE.length} prospect(s) ignore(s).`);
    lines.push(...Object.entries(reasons).map(([reason, count]) => `  - ${reason} (${count})`));
  } else {
    lines.push('Aucun prospect ignore aujourd\'hui.');
  }

  return lines.join('\n');
}
