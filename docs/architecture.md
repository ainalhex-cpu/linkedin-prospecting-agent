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

## Ce qui n'est PAS construit en V1 (volontairement)

- Aucune connexion a LinkedIn (scraping, automatisation, API).
- Aucune integration CRM / Notion / Sheets (prevu pour V2, voir section 23).
- Aucune IA generative pour transformer un profil brut en signaux : en V1,
  les signaux sont saisis a la main (ou via un script d'import qu'on peut
  brancher plus tard sur `src/schema/prospect.js`).
