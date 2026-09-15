# Architecture V1

## Objectif

Construire le "cerveau" de l'agent de prospection : identifier, qualifier, scorer,
classer et suivre dans le temps des prospects LinkedIn, sans automatiser la
moindre action sur LinkedIn (voir section 22 du brief, `docs/assumptions.md`).

## Choix techniques

- **Node.js (ESM), zero dependance externe.** Le besoin V1 (regles metier,
  scoring, tri, stockage JSON) ne justifie aucune librairie. Ca reduit la
  surface d'attaque, la maintenance, et les couts (pas d'API payante).
- **Tests : `node:test` (runner integre a Node 20+).** Pas besoin de Jest/Vitest
  pour ce perimetre.
- **Stockage : fichiers JSON (`/data`).** Suffisant pour une V1 mono-utilisateur.
  Le module `src/store/prospectStore.js` isole totalement la persistance : le
  jour ou on branche un vrai CRM/Notion/Sheet, seul ce module change.
- **Regles metier dans `/config` (JSON), jamais dans le code.** ICP, bareme de
  scoring, offres, catalogue de signaux, seuils de temperature et statuts de
  pipeline sont des donnees, pas du code. On peut les modifier sans toucher
  aux moteurs dans `/src`.

## Flux de donnees

```
input brut (JSON, saisie manuelle en V1)
        |
        v
createProspect()  --------->  fiche prospect normalisee (schema/prospect.js)
        |
        v
findDuplicate()  ----------->  fusion si doublon (deduplication/)
        |
        v
qualify()  ------------------> exclusion ? (qualification/)
        |                           |
        | non exclu                | exclu
        v                           v
calculateScore()            IGNORE direct, aucun score invente
        |
        v
determineTemperature()  -----> HOT / WARM / COLD
        |
        v
matchOffer()  ----------------> VISIBILITE / SERENITE / LIBERTE / NON_IDENTIFIE
        |
        v
analyzeProspect() (orchestrateur) -> fiche a jour + historique + justification
        |
        v
formatOutput()  --------------> texte lisible (section 15 du brief)
```

Chaque moteur (`scoring`, `qualification`, `temperature`, `offer_matching`,
`deduplication`, `pipeline`) est une fonction pure : entree = donnees +
config, sortie = resultat. Aucun effet de bord, aucun acces disque. Ca les
rend triviaux a tester et a faire evoluer independamment.

`src/analysis/index.js` est le seul orchestrateur : il enchaine les moteurs
dans le bon ordre et gere l'historisation (score/temperature dans le temps).

## Principe "fait vs hypothese"

Le schema de prospect separe explicitement :
- `faits_observes` (texte libre, preuves concretes) ;
- `hypotheses` (texte libre, interpretations non confirmees) ;
- `signals` (booleens structures, consommes par les moteurs).

Le moteur ne "devine" jamais un signal a partir du texte : c'est a l'analyste
(humain, ou un futur module d'extraction) de transformer un fait observe en
signal structure. Ca evite qu'une hypothese se transforme silencieusement en
fait dans le score.

## Deduplication

Ordre de priorite : URL LinkedIn normalisee > `linkedin_id` > combinaison
prenom+nom+entreprise (normalises, insensibles a la casse). Un doublon
declenche une fusion (`upsertProspect`) plutot qu'une creation.

## Historique

`historique_score` et `historique_temperature` sont des journaux d'evenements
(date, valeur, evenement declencheur), ajoutes uniquement quand la valeur
change (ou lors de la toute premiere analyse). Ca permet de repondre a "montre
moi comment ce prospect a evolue" sans recalcul retroactif.

## Priorisation

`src/pipeline/index.js` trie par un ordre lexicographique de criteres
(score_fit, score_maturite, score_probleme, score_intention, facilite_contact,
recence) plutot qu'un simple tri par score total, pour rester fidele a l'ordre
de priorite explicite du brief (section 16). Voir `assumptions.md` pour le
detail de ce choix.

## Interface (CLI + web)

`src/server/api.js` est une couche de service partagee, sans regle metier
propre : elle enchaine `schema/prospect.js` (creation), `deduplication/`,
`analysis/` (analyse) et `pipeline/` (priorisation), au-dessus de
`store/prospectStore.js`. La CLI (`src/cli.js`) et le serveur HTTP
(`src/server/server.js`) appellent tous les deux cette meme couche — aucune
logique n'est dupliquee entre les deux interfaces.

`src/server/server.js` est un serveur HTTP minimal (`node:http`, sans
framework) qui sert les fichiers statiques de `/public` (une page HTML +
CSS + JS vanilla, sans build step) et expose une petite API JSON
(`/api/config`, `/api/prospects`, `/api/analyze`, `/api/top`, etc.). Le
front-end (`public/app.js`) ne code en dur aucun signal ni aucune regle : il
recupere le catalogue de signaux, le bareme et les offres via `/api/config`
(qui relit directement les fichiers de `/config`), et se contente de les
afficher et de les envoyer a l'API au moment de l'analyse.

## Extraction de signaux a partir d'un texte brut (V1.1)

`src/extraction/index.js` transforme un texte colle par l'utilisateur en
signaux structures, sans faire ni scoring ni qualification. C'est un moteur
a base de regles (regex sur `config/extraction_patterns.json`), pas une IA
generative : deterministe, auditable, et sans appel externe. Il ne connait
rien du bareme de scoring — il produit uniquement des booleens `signals`
(meme structure que ceux coches a la main dans le formulaire), des preuves
litterales (`evidences`), et une confiance globale d'extraction, qui reste
purement informative.

Regles de fonctionnement :
- **Jamais d'invention.** Un signal n'est retenu que si une regex trouve une
  phrase reelle dans le texte fourni ; cette phrase devient la preuve.
- **Confiance haute/moyenne -> signal applique (fait).** La phrase alimente
  `faits_observes` et le booleen `signals.<categorie>.<cle>` passe a `true`.
- **Confiance faible -> hypothese, signal NON applique.** La phrase alimente
  `hypotheses` (formulee comme "a confirmer"), mais ne force pas le booleen
  a `true` : ca respecte la meme regle que le reste du projet ("ne jamais
  transformer une hypothese en fait", section 6 du brief V1).
- **Exclusion reservee a la confiance haute** (`apply_min_confidence.exclusion
  = "high"` dans `config/extraction_patterns.json`) : un texte ambigu ne peut
  jamais faire passer un prospect en IGNORE tout seul.
- **`marche_francophone`** est deduit du champ `pays` (correspondance
  litterale avec `config/icp.json`), pas du texte libre — c'est une donnee
  structuree, pas une interpretation.

`src/server/api.js` expose `analyzeRawText(input, config, filePath)` qui
appelle `extractFromText()` PUIS reutilise `addAndAnalyze()` tel quel (donc
`qualify` -> `calculateScore` -> `determineTemperature` -> `matchOffer`,
tous inchanges). Le flux est : texte brut -> extraction -> qualification
existante -> scoring existant -> temperature existante -> offre existante ->
action existante. Aucune regle de scoring n'a ete dupliquee ou modifiee pour
cette fonctionnalite.

`analyzeRawText` reste isole : remplacer demain "texte colle a la main" par
une source de donnees autorisee, une integration, ou Claude Cowork ne
demandera de changer que la fonction qui produit `{ text, pays }` en entree
de `extractFromText` — le moteur d'extraction et le moteur de scoring restent
inchanges.

## Ce qui n'est PAS construit en V1 / V1.1 (volontairement)

- Aucune connexion a LinkedIn (scraping, automatisation, API).
- Aucune integration CRM / Notion / Sheets (prevu pour V2, voir section 23).
- Aucune IA generative (LLM, API externe) pour l'extraction de signaux : le
  moteur d'extraction est a base de regles explicites et modifiables
  (`config/extraction_patterns.json`), pas un modele de langage.
