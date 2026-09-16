import { randomUUID } from 'node:crypto';

/**
 * Structure de signaux vides. Toutes les cles sont des booleens que
 * l'analyste (humain ou futur module de collecte) renseigne a partir de
 * faits observes. Une cle absente ou false = signal non confirme, jamais
 * "invente" par le moteur.
 */
export function emptySignals() {
  return {
    fit: {
      coach_business_entrepreneuriat: false,
      activite_etablie: false,
      marche_francophone: false
    },
    maturite: {
      offre_commercialisee: false,
      clients_audience_etablis: false,
      croissance_visible: false,
      delegation_equipe_prestataires: false
    },
    probleme: {
      manque_de_temps: false,
      communication: false,
      organisation: false,
      operations: false,
      experience_client: false,
      besoin_delegation: false
    },
    intention: {
      delegation_explicitement_recherchee: false,
      recrutement: false,
      recherche_aide_prestataire: false,
      croissance_importante_lancement: false
    },
    contexte: {
      plusieurs_offres: false,
      forte_croissance: false,
      lancements_reguliers: false,
      equipe_ou_prestataires: false,
      besoin_coordination: false
    },
    exclusion: {
      debutant: false,
      aucune_offre: false,
      activite_inactive: false,
      hors_cible: false,
      sans_capacite_delegation: false,
      mauvais_marche: false,
      profil_trop_eloigne: false,
      informations_insuffisantes: false
    }
  };
}

function mergeSignals(input = {}) {
  const base = emptySignals();
  for (const category of Object.keys(base)) {
    if (input[category]) {
      Object.assign(base[category], input[category]);
    }
  }
  return base;
}

/**
 * Cree une fiche prospect complete a partir d'un input partiel.
 * Champs manquants -> valeurs neutres explicites (jamais de valeur inventee).
 */
export function createProspect(input = {}) {
  const now = new Date().toISOString();
  return {
    id: input.id || randomUUID(),
    nom: input.nom || '',
    prenom: input.prenom || '',
    entreprise: input.entreprise || '',
    pays: input.pays || 'Non identifie',
    url_linkedin: input.url_linkedin || '',
    linkedin_id: input.linkedin_id || '',
    activite: input.activite || 'Non identifie',
    type_prospect: input.type_prospect || 'Non identifie',
    offre: input.offre || 'Non identifie',
    audience: input.audience || 'Non identifie',
    niveau_maturite: input.niveau_maturite || 'Non identifie',
    activite_linkedin: input.activite_linkedin || 'Non identifie',
    signaux_observes: input.signaux_observes || [],
    problemes_potentiels: input.problemes_potentiels || [],
    faits_observes: input.faits_observes || [],
    hypotheses: input.hypotheses || [],
    sources: input.sources || [],

    // Signaux structures utilises par les moteurs (scoring / qualification / offre)
    signals: mergeSignals(input.signals),

    // Resultats de la derniere analyse (calcules par src/analysis, jamais saisis a la main)
    score_fit: input.score_fit ?? null,
    score_maturite: input.score_maturite ?? null,
    score_probleme: input.score_probleme ?? null,
    score_intention: input.score_intention ?? null,
    score_total: input.score_total ?? null,
    temperature: input.temperature || null,
    offre_recommandee: input.offre_recommandee || null,
    justification: input.justification || '',
    justification_offre: input.justification_offre || null,
    justification_action: input.justification_action || null,
    action_recommandee: input.action_recommandee || null,
    prochaine_action: input.prochaine_action || '',
    probleme_principal: input.probleme_principal || null,
    problemes_secondaires: input.problemes_secondaires || [],
    niveau_confiance: input.niveau_confiance || null,
    signaux_intention_detectes: input.signaux_intention_detectes || [],
    raisons_exclusion: input.raisons_exclusion || [],

    // Pipeline & suivi
    statut_pipeline: input.statut_pipeline || 'Nouveau',
    date_decouverte: input.date_decouverte || now,
    derniere_analyse: input.derniere_analyse || null,
    historique_interactions: input.historique_interactions || [],
    historique_score: input.historique_score || [],
    historique_temperature: input.historique_temperature || [],
    facilite_contact: input.facilite_contact ?? null,
    notes: input.notes || '',

    // V2 - analyse semantique / opportunite / priorite (src/semantic-analysis,
    // src/opportunity, src/priority). Additifs : ne remplacent aucun champ V1.
    icp_assessment: input.icp_assessment || null,
    statut_professionnel: input.statut_professionnel || 'inconnu',
    activite_propre: input.activite_propre || 'NON_DEMONTREE',
    offre_commercialisee_v2: input.offre_commercialisee_v2 || 'NON_IDENTIFIEE',
    signals_v2: input.signals_v2 || [],
    intention_level: input.intention_level || null,
    opportunity_level: input.opportunity_level || null,
    opportunity_reason: input.opportunity_reason || null,
    priorite: input.priorite || null,
    historique_priorite: input.historique_priorite || [],
    action_recommandee_v2: input.action_recommandee_v2 || null,
    justification_action_v2: input.justification_action_v2 || null,
    comment_suggere: input.comment_suggere || null,
    message_suggere: input.message_suggere || null,
    derniere_analyse_v2: input.derniere_analyse_v2 || null
  };
}
