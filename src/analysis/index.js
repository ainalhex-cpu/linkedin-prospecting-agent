import { qualify } from '../qualification/index.js';
import { calculateScore } from '../scoring/index.js';
import { determineTemperature } from '../temperature/index.js';
import { matchOffer } from '../offer_matching/index.js';

function buildExclusionJustification(raisons) {
  const labels = raisons.map((r) => r.label).join(', ');
  return `Prospect exclu (${labels}). Aucun score calcule pour eviter d'inventer une qualification. Statut : Hypothese a confirmer / Non identifie si de nouvelles informations apparaissent.`;
}

function buildOfferJustification(offerResult, offersConfig, signalsConfig) {
  if (offerResult.offre === 'NON_IDENTIFIE') {
    return "Aucun signal de probleme suffisant n'a ete observe : offre non identifiee (hypothese a confirmer).";
  }
  const label = offersConfig[offerResult.offre]?.label || offerResult.offre;
  const signalLabels = offerResult.signaux_detectes
    .map((key) => signalsConfig.labels?.[key] || key)
    .join(', ');
  return `Offre ${label} recommandee sur la base des signaux observes : ${signalLabels || 'non identifie'}.`;
}

function buildJustification({ offerResult, scoreResult, temperature, offersConfig, signalsConfig }) {
  const offerJustification = buildOfferJustification(offerResult, offersConfig, signalsConfig);
  return `${offerJustification} Score total ${scoreResult.score_total}/100 -> temperature ${temperature}.`;
}

function buildActionJustification({ temperature, action, intentionSignals, scoreTotal }) {
  switch (action) {
    case 'CONVERSATION': {
      const labels = intentionSignals.map((s) => s.label).join(', ');
      return `Score total ${scoreTotal}/100 (>= seuil HOT) ET signal(aux) d'intention reel(s) detecte(s) : ${labels}. Une conversation directe est justifiee.`;
    }
    case 'WARM_UP':
      if (intentionSignals.length === 0) {
        return `Score total ${scoreTotal}/100 : excellent profil, mais aucun signal d'intention reel observe. Un score eleve seul ne suffit pas a declencher une conversation : on cree du lien avant d'aller plus loin.`;
      }
      return `Score total ${scoreTotal}/100 : bon profil avec un debut d'intention (${intentionSignals
        .map((s) => s.label)
        .join(', ')}), mais pas encore suffisant pour une conversation directe.`;
    case 'NURTURE':
      return `Score total ${scoreTotal}/100 : profil interessant mais encore trop peu mature ou peu de signaux de probleme/intention pour justifier une action immediate.`;
    case 'IGNORE':
    default:
      return 'Prospect exclu : voir les raisons d\'exclusion ci-dessus.';
  }
}

function listTrueSignals(categorySignals, labels) {
  return Object.entries(categorySignals || {})
    .filter(([, value]) => value === true)
    .map(([key]) => ({ key, label: labels?.[key] || key }));
}

function buildProblemBreakdown(offerResult, signalsConfig) {
  const detected = offerResult.signaux_detectes || [];
  if (detected.length === 0) {
    return { principal: null, secondaires: [] };
  }
  const [principalKey, ...rest] = detected;
  return {
    principal: signalsConfig.labels?.[principalKey] || principalKey,
    secondaires: rest.map((key) => signalsConfig.labels?.[key] || key)
  };
}

function assessConfidence(prospect) {
  const hasFaits = (prospect.faits_observes || []).some((f) => f && f.trim());
  const hasHypotheses = (prospect.hypotheses || []).some((h) => h && h.trim());
  if (hasFaits) return 'Eleve (appuye sur des faits observes)';
  if (hasHypotheses) return 'Faible (hypotheses uniquement, a confirmer)';
  return 'Non determine (aucun fait ni hypothese renseigne)';
}

function nextActionSuggestion(action, offre) {
  switch (action) {
    case 'CONVERSATION':
      return "Engager une conversation humaine ciblee, en reference au signal d'intention observe.";
    case 'WARM_UP':
      return 'Interagir avec son contenu / engagement leger pour creer du lien avant toute approche directe.';
    case 'NURTURE':
      return 'Observer et laisser murir : revisiter la fiche lors du prochain signal significatif.';
    case 'IGNORE':
    default:
      return "Aucune action necessaire pour le moment.";
  }
}

/**
 * Analyse complete d'un prospect. Fonction pure : ne mute pas l'input,
 * retourne un nouvel objet prospect a jour + le texte de sortie formate.
 */
export function analyzeProspect(prospect, config, { event } = {}) {
  const now = new Date().toISOString();
  const qualification = qualify(prospect.signals, config.signals);

  let updated;

  if (qualification.excluded) {
    const exclusionJustification = buildExclusionJustification(qualification.raisons);
    updated = {
      ...prospect,
      score_fit: null,
      score_maturite: null,
      score_probleme: null,
      score_intention: null,
      score_total: null,
      temperature: 'IGNORE',
      offre_recommandee: 'NON_IDENTIFIE',
      justification: exclusionJustification,
      justification_offre: null,
      justification_action: exclusionJustification,
      action_recommandee: 'IGNORE',
      prochaine_action: nextActionSuggestion('IGNORE'),
      probleme_principal: null,
      problemes_secondaires: [],
      niveau_confiance: assessConfidence(prospect),
      signaux_intention_detectes: [],
      raisons_exclusion: qualification.raisons,
      derniere_analyse: now
    };
  } else {
    const scoreResult = calculateScore(prospect.signals, config.scoring);
    const temperature = determineTemperature(scoreResult.score_total, prospect.signals, config.thresholds);
    const offerResult = matchOffer(prospect.signals, config.offers);
    const action = config.thresholds.action_map[temperature];
    const intentionSignals = listTrueSignals(prospect.signals.intention, config.signals.labels);
    const { principal, secondaires } = buildProblemBreakdown(offerResult, config.signals);
    const justification = buildJustification({
      offerResult,
      scoreResult,
      temperature,
      offersConfig: config.offers,
      signalsConfig: config.signals
    });
    const justificationAction = buildActionJustification({
      temperature,
      action,
      intentionSignals,
      scoreTotal: scoreResult.score_total
    });

    updated = {
      ...prospect,
      score_fit: scoreResult.score_fit,
      score_maturite: scoreResult.score_maturite,
      score_probleme: scoreResult.score_probleme,
      score_intention: scoreResult.score_intention,
      score_total: scoreResult.score_total,
      temperature,
      offre_recommandee: offerResult.offre,
      justification,
      justification_offre: buildOfferJustification(offerResult, config.offers, config.signals),
      justification_action: justificationAction,
      action_recommandee: action,
      prochaine_action: nextActionSuggestion(action, offerResult.offre),
      probleme_principal: principal,
      problemes_secondaires: secondaires,
      niveau_confiance: assessConfidence(prospect),
      signaux_intention_detectes: intentionSignals,
      raisons_exclusion: [],
      derniere_analyse: now
    };
  }

  updated = recordHistory(prospect, updated, now, event);

  return updated;
}

function recordHistory(previous, updated, timestamp, event) {
  const historique_score = [...(previous.historique_score || [])];
  const historique_temperature = [...(previous.historique_temperature || [])];

  const scoreChanged = previous.score_total !== updated.score_total;
  const temperatureChanged = previous.temperature !== updated.temperature;

  if (scoreChanged || historique_score.length === 0) {
    historique_score.push({
      date: timestamp,
      score_total: updated.score_total,
      evenement: event || (historique_score.length === 0 ? 'Analyse initiale' : 'Mise a jour du score')
    });
  }

  if (temperatureChanged || historique_temperature.length === 0) {
    historique_temperature.push({
      date: timestamp,
      temperature: updated.temperature,
      evenement: event || (historique_temperature.length === 0 ? 'Analyse initiale' : 'Changement de temperature')
    });
  }

  return { ...updated, historique_score, historique_temperature };
}

const TEMPERATURE_EMOJI = { HOT: '🔥 HOT', WARM: '🟠 WARM', COLD: '🔵 COLD', IGNORE: '❌ IGNORE' };
const ACTION_EMOJI = {
  CONVERSATION: '🔥 CONVERSATION',
  WARM_UP: '🟠 WARM-UP',
  NURTURE: '🔵 NURTURE',
  IGNORE: '❌ IGNORE'
};

/**
 * Formate la sortie texte attendue (section 15 du cahier des charges).
 */
export function formatOutput(prospect, config) {
  const offreLabel =
    prospect.offre_recommandee && prospect.offre_recommandee !== 'NON_IDENTIFIE'
      ? config.offers[prospect.offre_recommandee]?.label || prospect.offre_recommandee
      : 'Non identifie';

  const lines = [
    `[${(prospect.prenom || '').toUpperCase()} ${(prospect.nom || '').toUpperCase()}]`.trim(),
    `Activite :`,
    prospect.activite || 'Non identifie',
    ``,
    `Pourquoi il correspond a l'ICP :`,
    prospect.faits_observes.filter((f) => f).join(' ') || 'Non identifie',
    ``,
    `Signaux observes :`,
    prospect.signaux_observes.length ? prospect.signaux_observes.join(', ') : 'Non identifie',
    ``,
    `Probleme potentiel :`,
    prospect.problemes_potentiels.length ? prospect.problemes_potentiels.join(', ') : 'Non identifie',
    ``,
    `Faits vs hypotheses :`,
    `Faits : ${prospect.faits_observes.length ? prospect.faits_observes.join(' | ') : 'Non identifie'}`,
    `Hypotheses : ${prospect.hypotheses.length ? prospect.hypotheses.join(' | ') : 'Aucune'}`,
    ``,
    `Score : ${prospect.score_total ?? 'N/A'}/100`,
    `Temperature : ${TEMPERATURE_EMOJI[prospect.temperature] || prospect.temperature}`,
    `Offre recommandee : ${offreLabel}`,
    `Pourquoi :`,
    prospect.justification || 'Non identifie',
    `Action recommandee :`,
    ACTION_EMOJI[prospect.action_recommandee] || prospect.action_recommandee,
    `Prochaine action :`,
    prospect.prochaine_action || 'Non identifie'
  ];

  return lines.join('\n');
}
