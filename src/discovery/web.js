/**
 * Source de decouverte "web" (section 4-7 du brief V3) : genere des
 * requetes de recherche a partir de criteres, interroge un
 * WebSearchProvider (MOCK ici, aucun reseau, aucun scraping), extrait des
 * candidats structures des resultats, les deduplique, puis elimine ceux
 * manifestement hors sujet AVANT l'analyse semantique complete (qui reste
 * geree par src/semantic-analysis + le moteur V1/V2 existant).
 *
 * Rien ici ne scrape LinkedIn ni Instagram : le MockWebSearchProvider
 * simule des resultats de recherche generiques (title/url/snippet/source),
 * exactement la forme qu'un moteur de recherche autorise renverrait.
 */
import { normalizeUrl } from '../deduplication/index.js';

// ---------- 1. Generateur de requetes (section 3) ----------

/**
 * Produit des requetes "<mot-cle> <marche>" a partir de criteres. Les
 * mots-cles viennent de config/discovery_queries.json (jamais codes en
 * dur) ; `keywords` explicites dans les criteres les remplacent.
 */
export function buildSearchQueries({ country, market, profile_type, keywords } = {}, discoveryQueriesConfig) {
  const pays = country || market || null;
  const type = profile_type || discoveryQueriesConfig.default_profile_type;
  const terms =
    keywords && keywords.length ? keywords : discoveryQueriesConfig.templates[type] || discoveryQueriesConfig.templates[discoveryQueriesConfig.default_profile_type];

  return terms.map((term) => (pays ? `"${term}" ${pays}` : `"${term}"`));
}

// ---------- 2. WebSearchProvider (section 4) ----------

const MOCK_SEARCH_RESULTS = [
  {
    title: 'Alec Mercier - Coach business independant | LinkedIn',
    url: 'https://www.linkedin.com/in/alec-mercier-mock',
    snippet:
      "Coach business independant depuis 2018 chez Alec Mercier Coaching. J'accompagne les entrepreneurs. Je recrute actuellement un freelance pour m'aider a deleguer une partie de mon activite.",
    source: 'web_search_mock',
    pays: 'France',
    query_tags: ['coach business', 'coach entrepreneuriat', 'coach dirigeants']
  },
  {
    title: 'Alec Mercier | Site professionnel',
    url: 'https://alecmerciercoaching.fr',
    snippet: "Je suis Alec Mercier, coach business independant chez Alec Mercier Coaching depuis 2018. Mon programme d'accompagnement dure 6 mois.",
    source: 'web_search_mock',
    pays: 'France',
    query_tags: ['coach leadership']
  },
  {
    title: 'Nadia Belkacem - Coach business independante | LinkedIn',
    url: 'https://www.linkedin.com/in/nadia-belkacem-mock',
    snippet:
      "Coach business independante chez Nadia Belkacem Coaching. J'accompagne les dirigeants de PME depuis 12 ans. Mon accompagnement se fait sur 9 mois.",
    source: 'web_search_mock',
    pays: 'France',
    query_tags: ['coach business', 'coach dirigeants']
  },
  {
    title: 'Julien Fabre - Formateur independant | LinkedIn',
    url: 'https://www.linkedin.com/in/julien-fabre-mock',
    snippet:
      "Formateur independant depuis 8 ans chez JF Formation. Mon offre de formation en leadership s'adresse aux managers. J'ai lance mon programme il y a 3 ans.",
    source: 'web_search_mock',
    pays: 'Belgique',
    query_tags: ['formateur independant', 'expert formation']
  },
  {
    title: 'Claire Dubosc - Formatrice chez AFTRAL | LinkedIn',
    url: 'https://www.linkedin.com/in/claire-dubosc-mock',
    snippet: "Formatrice chez AFTRAL depuis 5 ans. J'accompagne les equipes pedagogiques du secteur transport, poste salarie au sein de l'equipe.",
    source: 'web_search_mock',
    pays: 'France',
    query_tags: ['formateur independant']
  },
  {
    title: 'Karim Haddad - Operations chez Le Cercle Ops | LinkedIn',
    url: 'https://www.linkedin.com/in/karim-haddad-mock',
    snippet:
      "Operations chez Le Cercle Ops. Je recrute un alternant pour rejoindre mon equipe, poste en alternance avec conversion CDI a 24 mois.",
    source: 'web_search_mock',
    pays: 'France',
    query_tags: ['coach business']
  },
  {
    title: 'Marion Lefevre - Etudiante en Ecole de Commerce | LinkedIn',
    url: 'https://www.linkedin.com/in/marion-lefevre-mock',
    snippet: 'Etudiante en formation initiale, premiere annee. Je debute tout juste dans le coaching, a la recherche de mon premier emploi.',
    source: 'web_search_mock',
    pays: 'France',
    query_tags: ['coach business']
  },
  {
    title: 'Boulangerie du Coin - Menu du jour | Site',
    url: 'https://boulangerie-du-coin-mock.fr',
    snippet: 'Decouvrez notre boulangerie artisanale, pain frais et viennoiseries chaque matin. Menu du jour disponible.',
    source: 'web_search_mock',
    pays: 'France',
    query_tags: ['coach business']
  },
  {
    title: 'Top 10 des meilleurs coachs business en France | Blog Entrepreneuriat',
    url: 'https://blog-entrepreneuriat-mock.fr/top-10-coachs',
    snippet: 'Classement des meilleurs coachs business a suivre cette annee. Notre guide complet des accompagnements disponibles.',
    source: 'web_search_mock',
    pays: 'France',
    query_tags: ['coach business']
  },
  {
    title: 'Sophie Laurent - Coach business & leadership | LinkedIn',
    url: 'https://www.linkedin.com/in/sophie-laurent-mock',
    snippet:
      "Coach business independante depuis 2016 chez Sophie Laurent Coaching. J'accompagne des dirigeants. Je cherche un freelance pour m'aider sur mon operationnel, une vraie recherche de bras droit externe.",
    source: 'web_search_mock',
    pays: 'France',
    query_tags: ['coach dirigeants']
  },
  {
    title: 'Marc Antoine - Coach entrepreneuriat | LinkedIn',
    url: 'https://www.linkedin.com/in/marc-antoine-mock',
    snippet:
      "Coach business independant chez Marc Antoine Coaching. J'accompagne des entrepreneurs depuis 2019. Je viens de lancer un nouveau programme, forte croissance de mon activite.",
    source: 'web_search_mock',
    pays: 'France',
    query_tags: ['coach entrepreneuriat']
  },
  {
    title: 'Julie Berger - Coach dirigeants | LinkedIn',
    url: 'https://www.linkedin.com/in/julie-berger-mock',
    snippet:
      "Coach business independante depuis 2017 chez Julie Berger Coaching. J'accompagne des dirigeants. Je recrute un prestataire freelance pour structurer mon organisation.",
    source: 'web_search_mock',
    pays: 'France',
    query_tags: ['coach dirigeants']
  },
  {
    title: 'Fabrice Meyer - Coach executive independant | LinkedIn',
    url: 'https://www.linkedin.com/in/fabrice-meyer-mock',
    snippet:
      "Coach executive independant depuis 2015 chez Fabrice Meyer Coaching. J'accompagne des dirigeants d'entreprise en Suisse. Mon programme d'accompagnement dure 12 mois.",
    source: 'web_search_mock',
    pays: 'Suisse',
    query_tags: ['coach executive independant']
  },
  {
    title: 'Isabelle Tremblay - Formatrice independante | LinkedIn',
    url: 'https://www.linkedin.com/in/isabelle-tremblay-mock',
    snippet:
      "Formatrice independante depuis 10 ans chez Isabelle Tremblay Formation au Quebec. Mon offre de formation en leadership s'adresse aux gestionnaires. J'ai lance mon programme il y a 5 ans.",
    source: 'web_search_mock',
    pays: 'Canada francophone',
    query_tags: ['formateur independant']
  },
  {
    title: 'Agence Immobiliere Perspective - Nos biens | Site',
    url: 'https://agence-perspective-mock.fr',
    snippet: 'Decouvrez nos biens immobiliers a vendre et a louer. Agence immobiliere de confiance depuis 20 ans.',
    source: 'web_search_mock',
    pays: 'France',
    query_tags: ['coach dirigeants']
  },
  {
    title: 'Recherche Alternant RevOps - Offre d\'emploi | Indeed Mock',
    url: 'https://indeed-mock.fr/offre/alternant-revops',
    snippet: 'Nous recrutons un alternant pour notre pole operations, poste en alternance avec conversion CDI. Rejoignez notre equipe.',
    source: 'web_search_mock',
    pays: 'France',
    query_tags: ['coach business']
  },
  {
    title: 'Amélie Roux - Consultante formatrice independante | LinkedIn',
    url: 'https://www.linkedin.com/in/amelie-roux-mock',
    snippet:
      "Consultante independante depuis 2014 chez Amelie Roux Conseil. J'accompagne des formateurs dans leur montee en competences. Mon accompagnement se fait sur 4 mois.",
    source: 'web_search_mock',
    pays: 'France',
    query_tags: ['consultant formateur']
  }
];

/**
 * Provider MOCK (aucun appel reseau). `search(query)` filtre le jeu de
 * donnees fixe ci-dessus selon le mot-cle et le marche encodes dans la
 * requete (format `"mot-cle" Pays`, produit par buildSearchQueries).
 */
export const MockWebSearchProvider = {
  name: 'mock_web_search',
  search(query) {
    const match = query.match(/^"(.+)"(?:\s+(.+))?$/);
    const term = match ? match[1] : query;
    const pays = match ? match[2] : null;

    return MOCK_SEARCH_RESULTS.filter((r) => r.query_tags.includes(term) && (!pays || r.pays === pays)).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      source: r.source
    }));
  }
};

// ---------- 3. Extraction des candidats (section 5) ----------

/**
 * Transforme un resultat de recherche brut en candidat structure. N'invente
 * rien : un champ non identifiable reste `null` plutot que devine.
 */
export function extractCandidate(result, query) {
  const nameMatch = (result.title || '').match(/^([A-ZÀ-Ÿ][\wà-ÿ'-]+(?:\s+[A-ZÀ-Ÿ][\wà-ÿ'-]+)+)\s*[-|–]/);
  const nom = nameMatch ? nameMatch[1].trim() : null;

  const entrepriseMatch =
    (result.snippet || '').match(/chez\s+([A-ZÀ-Ÿ][\w &'-]{2,50}?)(?:\.|,|\s+depuis|\s+au\b|$)/i) ||
    (result.title || '').match(/chez\s+([A-ZÀ-Ÿ][\w &'-]{2,50})/i);
  const entreprise = entrepriseMatch ? entrepriseMatch[1].trim() : null;

  const isLinkedin = /linkedin\.com\/in\//i.test(result.url || '');

  return {
    nom,
    entreprise,
    url: result.url || null,
    url_linkedin: isLinkedin ? result.url : null,
    site: !isLinkedin ? result.url || null : null,
    title: result.title || null,
    snippet: result.snippet || '',
    source: result.source || 'web_search_mock',
    requete: query,
    date_decouverte: new Date().toISOString()
  };
}

// ---------- 4. Deduplication (section 6) ----------

function normalizeName(str) {
  return (str || '').trim().toLowerCase();
}

function extractDomain(url) {
  if (!url) return null;
  return normalizeUrl(url).split('/')[0];
}

function candidateKeys(c) {
  const keys = [];
  if (c.url) keys.push(`url:${normalizeUrl(c.url)}`);
  if (c.url_linkedin) keys.push(`linkedin:${normalizeUrl(c.url_linkedin)}`);
  if (c.site) keys.push(`domain:${extractDomain(c.site)}`);
  if (c.nom && c.entreprise) keys.push(`noment:${normalizeName(c.nom)}|${normalizeName(c.entreprise)}`);
  return keys;
}

/**
 * Un meme prospect trouve par plusieurs requetes reste UN candidat : les
 * requetes/sources/dates de chaque occurrence sont conservees sur le
 * candidat canonique (section 6 et 9 du brief V3 : tracabilite des
 * sources).
 */
export function dedupeCandidates(rawCandidates) {
  const canonicalByKey = new Map();
  const canonicalList = [];

  for (const candidate of rawCandidates) {
    const keys = candidateKeys(candidate);
    let existing = null;
    for (const key of keys) {
      if (canonicalByKey.has(key)) {
        existing = canonicalByKey.get(key);
        break;
      }
    }

    const sourceEntry = { requete: candidate.requete, url: candidate.url, source: candidate.source, date_decouverte: candidate.date_decouverte };

    if (existing) {
      existing.sources.push(sourceEntry);
      existing.derniere_decouverte = candidate.date_decouverte;
      existing.entreprise = existing.entreprise || candidate.entreprise;
      existing.url_linkedin = existing.url_linkedin || candidate.url_linkedin;
      // Un meme prospect trouve via plusieurs resultats peut porter des
      // preuves complementaires (ex: LinkedIn + site perso) : on les
      // combine plutot que de perdre celles qui ne sont pas sur le tout
      // premier resultat trouve, sans dupliquer un texte deja inclus.
      if (candidate.snippet && !existing.snippet.includes(candidate.snippet)) {
        existing.snippet = `${existing.snippet} ${candidate.snippet}`.trim();
      }
      for (const key of keys) canonicalByKey.set(key, existing);
    } else {
      const canonical = {
        ...candidate,
        sources: [sourceEntry],
        premiere_decouverte: candidate.date_decouverte,
        derniere_decouverte: candidate.date_decouverte
      };
      canonicalList.push(canonical);
      for (const key of keys) canonicalByKey.set(key, canonical);
    }
  }

  return canonicalList;
}

// ---------- 5. Pre-qualification (section 7) ----------

function textOf(candidate) {
  return `${candidate.title || ''} ${candidate.snippet || ''}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Elimine un candidat AVANT l'analyse semantique complete, uniquement sur
 * une preuve positive de non-pertinence. Ne bloque jamais un candidat pour
 * simple manque d'information ("inconnu" != "hors cible", section 7).
 */
export function preQualifyCandidate(candidate, prequalConfig, statutConfig) {
  if (!candidate.nom) {
    return { keep: false, reason: 'Aucune personne identifiable (resultat generique ou institutionnel)' };
  }

  const normalizedTitle = (candidate.title || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  if (prequalConfig.generic_content_title_patterns.some((p) => new RegExp(p, 'i').test(normalizedTitle))) {
    return { keep: false, reason: 'Contenu generique (article/liste), pas un profil individuel' };
  }

  const text = textOf(candidate);
  if (prequalConfig.student_or_beginner_patterns.some((p) => new RegExp(p, 'i').test(text))) {
    return { keep: false, reason: 'Profil etudiant ou debutant manifeste' };
  }

  const hasRelevantTopic = prequalConfig.relevant_topic_keywords.some((k) => text.includes(k));
  const hasOffTopic = prequalConfig.off_topic_keywords.some((k) => text.includes(k));
  if (hasOffTopic && !hasRelevantTopic) {
    return { keep: false, reason: 'Hors sujet thematique (aucun rapport avec coaching/formation/accompagnement)' };
  }

  const salarieInterneMatch = statutConfig.contexte_signal.salarie_interne.some((r) => new RegExp(r.pattern, 'i').test(text));
  const INDEPENDANT_STATUT_KEYS = ['fondateur', 'dirigeant', 'coach_independant', 'formateur_independant', 'consultant_independant', 'independant'];
  const independantStatutRules = INDEPENDANT_STATUT_KEYS.flatMap((key) => statutConfig.statut_professionnel[key] || []);
  const secondaireRules = statutConfig.profil_type?.secondaire || [];
  const hasIndependantVocab = [...independantStatutRules, ...secondaireRules].some((r) => new RegExp(r.pattern, 'i').test(text));
  if (salarieInterneMatch && !hasIndependantVocab) {
    return { keep: false, reason: 'Recrutement salarie manifeste (poste interne), pas un profil independant a prospecter' };
  }

  return { keep: true, reason: null };
}

export function preQualifyCandidates(candidates, prequalConfig, statutConfig) {
  const kept = [];
  const eliminated = [];
  for (const candidate of candidates) {
    const verdict = preQualifyCandidate(candidate, prequalConfig, statutConfig);
    if (verdict.keep) kept.push(candidate);
    else eliminated.push({ ...candidate, raison_elimination: verdict.reason });
  }
  return { kept, eliminated };
}

// ---------- 6. Source de decouverte complete ----------

/**
 * `discoverProspectsWeb(criteria, { provider, config })` enchaine
 * generation de requetes -> recherche -> extraction -> deduplication ->
 * pre-qualification. Ne fait AUCUNE analyse semantique ni scoring : ca
 * reste le rôle du pipeline existant (src/semantic-analysis + moteur V1/V2),
 * applique ensuite par l'orchestrateur (src/server/api.js).
 */
export function discoverProspectsWeb(criteria = {}, { provider = MockWebSearchProvider, config } = {}) {
  const queries = buildSearchQueries(criteria, config.discoveryQueries);

  const rawCandidates = [];
  for (const query of queries) {
    const results = provider.search(query) || [];
    for (const result of results) {
      rawCandidates.push(extractCandidate(result, query));
    }
  }

  const deduped = dedupeCandidates(rawCandidates);
  const doublons = rawCandidates.length - deduped.length;

  const { kept, eliminated } = preQualifyCandidates(deduped, config.discoveryPrequalification, config.statut);

  const limit = criteria.limit || 10;
  const candidates = kept.slice(0, limit);

  return {
    candidates,
    stats: {
      requetes: queries.length,
      resultats_bruts: rawCandidates.length,
      doublons,
      hors_cible: eliminated.length
    },
    eliminated
  };
}

export function createWebDiscoverySource(config, provider = MockWebSearchProvider) {
  return {
    name: 'web',
    discoverProspects: (criteria) => discoverProspectsWeb(criteria, { provider, config })
  };
}
