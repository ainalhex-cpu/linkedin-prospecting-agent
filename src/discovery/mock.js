/**
 * Source de decouverte MOCK (V2, conservee telle quelle en V3 pour la
 * retro-compatibilite). Jeu de donnees fixe en memoire, aucun reseau.
 *
 * IMPORTANT : ce fichier ne doit pas changer de comportement — les tests
 * V2 existants (tests/discovery/discovery.test.js,
 * tests/server/v2_workflow.test.js) dependent de ce jeu de donnees exact.
 * Le jeu de donnees plus riche demande par la V3 (section 18 : >= 15
 * resultats avec doublons, profils faibles, hors cible...) vit a part,
 * dans src/discovery/web.js, cote source "web" (recherche), qui est le
 * contexte ou ce type de bruit a du sens (des resultats de recherche, pas
 * une liste de prospects deja qualifies).
 */

export const MOCK_PROSPECTS = [
  {
    prenom: 'Alec',
    nom: 'Mercier',
    entreprise: 'Alec Mercier Coaching',
    pays: 'France',
    type: 'coach_business',
    url_linkedin: 'https://www.linkedin.com/in/alec-mercier-mock',
    texte_brut: `Coach business independant depuis 2018. J'accompagne les entrepreneurs qui veulent structurer leur croissance.
Mon programme d'accompagnement dure 6 mois. Mes clients ont deja genere plus de 2 millions d'euros de chiffre d'affaires cumule.
Je recrute actuellement un freelance pour m'aider a deleguer une partie de mon activite, je n'ai plus le temps de tout gerer moi-meme.`
  },
  {
    prenom: 'Nadia',
    nom: 'Belkacem',
    entreprise: 'Nadia Belkacem Coaching',
    pays: 'France',
    type: 'coach_business',
    url_linkedin: 'https://www.linkedin.com/in/nadia-belkacem-mock',
    texte_brut: `Coach business independante. J'accompagne les dirigeants de PME depuis 12 ans.
Mon accompagnement se fait sur 9 mois. Ma communaute est en pleine croissance, 12000 abonnes.
Nous passons parfois beaucoup de temps a courir apres des objectifs en oubliant ce qui nous anime vraiment.`
  },
  {
    prenom: 'Julien',
    nom: 'Fabre',
    entreprise: 'JF Formation',
    pays: 'Belgique',
    type: 'formateur_independant',
    url_linkedin: 'https://www.linkedin.com/in/julien-fabre-mock',
    texte_brut: `Formateur independant depuis 8 ans. Mon offre de formation en leadership s'adresse aux managers.
J'ai lance mon programme il y a 3 ans, mes clients me recommandent regulierement.
Je dois deleguer une partie de mon administratif, ca me prend trop de temps.`
  },
  {
    prenom: 'Claire',
    nom: 'Dubosc',
    entreprise: 'AFTRAL',
    pays: 'France',
    type: 'formateur_salarie',
    url_linkedin: 'https://www.linkedin.com/in/claire-dubosc-mock',
    texte_brut: `Formatrice chez AFTRAL depuis 5 ans. J'accompagne les equipes pedagogiques du secteur transport.
Ravie de partager mon quotidien de formatrice salariee au sein de l'equipe pedagogique.`
  },
  {
    prenom: 'Karim',
    nom: 'Haddad',
    entreprise: 'Le Cercle Ops',
    pays: 'France',
    type: 'salarie_recrute',
    url_linkedin: 'https://www.linkedin.com/in/karim-haddad-mock',
    texte_brut: `Operations chez Le Cercle Ops. Je recrute un alternant pour rejoindre mon equipe, poste en alternance avec conversion CDI a 24 mois.
Je porte seul tout l'operationnel du pole, c'est devenu trop pour une personne.`
  },
  {
    prenom: 'Marion',
    nom: 'Lefevre',
    entreprise: 'Marion Lefevre Coaching',
    pays: 'France',
    type: 'debutant',
    url_linkedin: 'https://www.linkedin.com/in/marion-lefevre-mock',
    texte_brut: `Je debute tout juste en tant que coach. Je n'ai pas encore de programme ni de clients, mais je suis motivee.`
  }
];

/**
 * discoverProspects({ country, type, limit }) -> liste de prospects bruts.
 * Ne fait aucun appel reseau : filtre le jeu de donnees mock en memoire.
 */
export function discoverProspects({ country, type, limit = 10 } = {}) {
  let results = MOCK_PROSPECTS;
  if (country) {
    const normalized = country.trim().toLowerCase();
    results = results.filter((p) => p.pays.toLowerCase() === normalized);
  }
  if (type) {
    results = results.filter((p) => p.type === type);
  }
  return results.slice(0, limit).map((p) => ({ ...p }));
}

/**
 * Wrapper conforme a l'interface DiscoverySource (section 1 du brief V3) :
 * { name, discoverProspects(criteria) -> { candidates, stats } }. Utilise
 * par le moteur de decouverte (src/discovery/index.js) quand la source
 * "mock" est selectionnee explicitement ; `discoverProspects` ci-dessus
 * reste l'export historique (V2) inchange.
 */
export const MockDiscoverySource = {
  name: 'mock',
  discoverProspects(criteria = {}) {
    const candidates = discoverProspects(criteria);
    return {
      candidates,
      stats: {
        requetes: 0,
        resultats_bruts: candidates.length,
        doublons: 0,
        hors_cible: 0
      }
    };
  }
};
