/**
 * Section 13/14/18 du brief V2 : ajuste l'action recommandee du moteur
 * existant en fonction de la RECENCE du signal declencheur, et prepare (sans
 * jamais envoyer) un commentaire ou un message suggere. L'utilisateur garde
 * toujours la validation finale ; ce module ne connecte rien a LinkedIn.
 */

const DOWNGRADE = { CONVERSATION: 'WARM_UP', WARM_UP: 'NURTURE', NURTURE: 'NURTURE', IGNORE: 'IGNORE' };

function ageInDays(date, now) {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor((now.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * `v1Action` est l'action deja calculee par le moteur existant
 * (config/thresholds.json -> action_map, via src/analysis). Ce module ne la
 * recalcule jamais depuis zero : il ne fait que la retrograder d'un cran si
 * le signal qui la justifie est trop ancien, en conservant toujours la
 * raison (section 14 : "ne pas changer le score/l'action sans conserver la
 * raison").
 */
export function computeActionV2({ v1Action, icpQualification, signalDate, now = new Date() }, config) {
  if (icpQualification === 'HORS_ICP') {
    return { action: 'IGNORE', reason: 'Hors ICP : aucune action commerciale justifiee.' };
  }

  const thresholdDays = config.intentLevels.recency_threshold_days ?? 60;
  const age = ageInDays(signalDate, now);

  if (age !== null && age > thresholdDays && (v1Action === 'CONVERSATION' || v1Action === 'WARM_UP')) {
    return {
      action: DOWNGRADE[v1Action],
      reason: `Signal declencheur ancien (${age} jours, seuil ${thresholdDays}) : action retrogradee de ${v1Action} a ${DOWNGRADE[v1Action]}.`
    };
  }

  return {
    action: v1Action,
    reason:
      age === null
        ? 'Aucune date de signal fournie : action alignee sur le moteur existant (recence non penalisante par defaut).'
        : `Signal recent (${age} jours) : action alignee sur le moteur existant.`
  };
}

/**
 * Brouillon de commentaire (jamais envoye automatiquement). Reagit a une
 * preuve reelle et precise plutot que de paraphraser tout le post ou de
 * vendre directement.
 */
export function suggestComment(prospect) {
  const evidence = (prospect.faits_observes || [])[0];
  if (!evidence) return null;
  return {
    brouillon: `Reagir precisement a : "${evidence}" - poser une question genuine sur ce point (pas de compliment generique, pas de pitch).`,
    a_valider_par: 'utilisateur',
    evidence
  };
}

/**
 * Brouillon de message (jamais envoye automatiquement), uniquement propose
 * quand l'opportunite est reellement forte.
 */
export function suggestMessage(prospect, opportunity) {
  if (!opportunity || opportunity.opportunity_level !== 'FORTE') return null;
  const topSignal = opportunity.contributions?.[0];
  if (!topSignal) return null;

  return {
    brouillon: `Bonjour ${prospect.prenom || ''}, j'ai vu que vous mentionniez : "${topSignal.evidence}". Ca m'a fait penser a [contexte pertinent] - est-ce le bon moment pour en discuter ?`,
    pourquoi_maintenant: opportunity.reason,
    a_valider_par: 'utilisateur'
  };
}
