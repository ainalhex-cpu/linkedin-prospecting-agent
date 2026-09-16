/**
 * Abstraction "Prospect Discovery" (section 15 du brief V2). Pour cette V2,
 * la source est un jeu de donnees MOCK (aucune connexion LinkedIn, aucun
 * scraping). L'architecture (une fonction qui prend des criteres et
 * retourne des prospects bruts) permet de brancher plus tard une source
 * autorisee sans changer le reste du pipeline (analyse, qualification,
 * scoring, priorisation restent identiques).
 */

const MOCK_PROSPECTS = [
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
