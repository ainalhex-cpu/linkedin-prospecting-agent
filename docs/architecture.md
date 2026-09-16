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

## V2 : decouverte, analyse semantique, opportunite, priorite, briefing

La V2 ajoute des modules AUTOUR du moteur V1 (qualification/scoring/
temperature/offer_matching), sans jamais le modifier :

```
discovery (mock) -> semantic-analysis -> [qualification/scoring/temperature/
                                           offer_matching EXISTANTS, inchanges]
                                                    |
                                                    v
                                    opportunity -> priority -> actions (V2)
                                                    |
                                                    v
                                       pipeline (existant) + briefing
```

**`src/semantic-analysis/index.js`** est le seul point ou la V2 "touche" au
moteur V1 : sa fonction `analyzeSemantic()` appelle `extractFromText()`
(V1.1, inchangee) puis construit un jeu de signaux V1 plus juste
(`v1_signals`) avant de le transmettre tel quel a `analyzeProspect()` (V1,
inchangee). Elle ne recalcule jamais un score : elle decide seulement quelles
preuves ont le droit d'atteindre le moteur de scoring existant. Trois
mecanismes de gating :

1. **Statut professionnel + activite propre gatent le FIT "coach business/
   entrepreneuriat"** (15 pts). Ce critere n'est mis a `true` que si
   `icp_assessment.qualification` vaut `ICP_PRINCIPAL` ou `ICP_SECONDAIRE`
   (statut non-salarie ET activite propre demontree par une preuve
   litterale — jamais un simple titre de poste). Un statut salarie force
   `signals.exclusion.hors_cible = true`, qui declenche l'exclusion V1
   existante (temperature IGNORE) sans qu'aucune nouvelle logique
   d'exclusion n'ait ete ecrite : le champ `hors_cible` existait deja dans
   le schema V1 mais n'avait jamais ete active avant la V2.
2. **Garde-fou "probleme du prospect vs probleme de ses clients"** : toute
   preuve dont la phrase contient un marqueur du type "mes clients"/"mes
   patientes" (config/statut_patterns.json -> `client_pain_guard`) est
   retiree des signaux `probleme`/`intention` transmis au scoring, sauf
   exception explicite (`suivi de mes clients` reste une charge reelle DU
   prospect). Le signal ecarte devient une hypothese tracee plutot que de
   disparaitre silencieusement.
3. **Contexte d'un signal ambigu** ("je recrute", "je cherche de l'aide") :
   determine via `config/statut_patterns.json -> contexte_signal`
   (salarie_interne / freelance_prestataire / associe / non_determine).
   Un recrutement en contexte salarie_interne est retire des signaux
   `intention` transmis au scoring (ce n'est pas une opportunite pour
   Dina), meme si le mot-cle brut avait matche en V1.1.

**`src/opportunity/index.js`** classe l'intention maximale retenue
(HIGH/MEDIUM/LOW/NO, `config/intent_levels.json`) puis la croise avec
`icp_assessment.qualification` (matrice `opportunity_matrix`) pour produire
`opportunity_level` (FORTE/MOYENNE/FAIBLE). Un HORS_ICP reste toujours
FAIBLE : le fit doit etre reel pour qu'une intention devienne une
opportunite commerciale (section 4 du brief V2).

**`src/priority/index.js`** est une fonction pure (pas de config) qui
traduit `{icp_qualification, opportunity_level, temperature}` en A/B/C/
IGNORE — une priorite OPERATIONNELLE, distincte du score et de la
temperature (section 12).

**`src/actions/index.js`** ajuste (jamais n'invente) l'action du moteur
existant selon la recence du signal declencheur (`config/intent_levels.json
-> recency_threshold_days`, 60 jours par defaut) : un signal trop ancien
retrograde CONVERSATION -> WARM_UP -> NURTURE, jamais l'inverse. Sans date
de signal fournie, l'action V1 n'est jamais penalisee (comportement neutre
par defaut). Ce module prepare aussi des brouillons de commentaire/message
(jamais envoyes), uniquement quand l'opportunite est FORTE.

**`src/discovery/index.js`** est une source MOCK (aucun reseau) derriere une
interface stable (`discoverProspects({country, type, limit})`) : brancher
une source autorisee plus tard ne changera que ce module.

**`src/briefing/index.js`** formate le pipeline existant (avec les champs V2)
en briefing quotidien groupe par priorite.

Voir `docs/assumptions.md` pour le detail des choix de conception (le
bucket `A_VERIFIER`, la matrice de priorite, le seuil de recence, etc.).

## V3 : Discovery Engine (decouverte automatique, phase 1 web)

La V3 remplace "je choisis un prospect dans une liste mock figee" par "le
systeme cherche lui-meme des candidats", en gardant l'invariant central du
projet : **le moteur V1/V2 (qualification/scoring/temperature/offer_matching/
opportunite/priorite) ne change pas**. Seule la maniere dont on obtient un
`raw prospect` en entree du pipeline evolue.

```
DiscoverySource.discoverProspects(criteria) -> { candidates, stats, eliminated }
        |
        v
normalizeDiscoveryInput() (src/server/api.js) -- adapte candidat -> input analyzeProspectV2
        |
        v
analyzeProspectV2() (V2, INCHANGEE) -> qualification/scoring/temperature/offre/action existants
        |
        v
opportunity/priority/actions (V2, INCHANGES)
```

**`src/discovery/` a une interface commune** :
`{ name, discoverProspects(criteria) -> { candidates, stats, eliminated } }`.

- `mock.js` : la source V2, verbatim (aucun changement de comportement,
  garantit la retro-compatibilite des tests V2 existants). Elle expose en
  plus un wrapper `MockDiscoverySource` conforme a la nouvelle interface.
- `web.js` : la nouvelle source "recherche". Decoupee en etapes pures et
  testables independamment :
  1. `buildSearchQueries(criteria, config.discoveryQueries)` — genere des
     requetes `"mot-cle" Pays` a partir de templates configurables (jamais
     codes en dur), avec priorite aux `keywords` explicites si fournis.
  2. `MockWebSearchProvider.search(query)` — provider MOCK synchrone,
     aucun reseau ; filtre un jeu d'environ 18 resultats fictifs geres en
     memoire selon le mot-cle et le marche encodes dans la requete.
  3. `extractCandidate(result, query)` — heuristique legere (regex) pour
     identifier nom/entreprise/URL LinkedIn/site depuis title/snippet.
     N'invente jamais : un champ non identifiable reste `null`.
  4. `dedupeCandidates(candidates)` — fusionne par URL exacte > URL
     LinkedIn > domaine > nom+entreprise (dans cet ordre de priorite),
     en conservant la liste des requetes/sources/dates de chaque
     occurrence sur le candidat canonique, et en combinant les preuves
     textuelles (snippets) distinctes plutot que de n'en garder qu'une.
  5. `preQualifyCandidate(candidate, config.discoveryPrequalification,
     config.statut)` — elimine un candidat AVANT l'analyse semantique
     complete, uniquement sur une preuve positive de non-pertinence
     (absence de nom identifiable, contenu generique/listicle, profil
     etudiant/debutant manifeste, hors sujet thematique, recrutement
     salarie manifeste sans aucun vocabulaire d'independance). Ne bloque
     jamais pour simple absence d'information.
- `instagram.js` / `linkedin.js` : interfaces preparees, non implementees
  (`discoverProspects` leve une erreur explicite). Documentent les
  contraintes a respecter le jour ou elles seront construites (pas de
  scraping, pas d'automatisation d'action, meme interface `DiscoverySource`,
  reutiliser `web.js` pour extraction/dedup/pre-qualification).
- `index.js` : `getDiscoverySource(name, config)` selectionne la source ;
  `discoverProspects()` reste exporte tel quel pour la retro-compatibilite
  V2 (defaut mock, tableau brut, comportement inchange).

**`src/server/api.js#normalizeDiscoveryInput`** est le seul point d'adaptation
entre le format "candidat de decouverte" (mock ou web, formats differents)
et l'entree attendue par `analyzeProspectV2` (INCHANGEE) : separation
prenom/nom, resolution du pays depuis les criteres de recherche si absent du
candidat, conversion des sources de decouverte en chaines lisibles pour le
champ `sources` (deja existant en V1). `runProspectingWorkflow` accepte
maintenant `source` (mock/web) et transmet `type`/`profile_type` aux deux
vocabulaires (V2 filtre exact, V3 templates de requetes) pour rester
compatible avec n'importe quelle source.

**Historique de decouverte** : `date_decouverte` (V1, inchange) sert de
"premiere decouverte" (fixee a la creation). `derniere_decouverte` (nouveau
champ additif) est mise a jour a chaque nouvelle decouverte du meme
prospect, sans jamais toucher a `historique_score`/`historique_temperature`/
`historique_priorite` deja enregistres.

## Ce qui n'est PAS construit en V1 / V1.1 / V2 / V3 (volontairement)

- Aucune connexion a LinkedIn (scraping, automatisation, API) : la
  decouverte V3 est une source "web" MOCK en memoire, aucun reseau.
- Aucun scraping Instagram non plus : `src/discovery/instagram.js` est une
  interface preparee, non implementee.
- Aucune integration CRM / Notion / Sheets (prevu pour une V4 eventuelle).
- Aucune IA generative (LLM, API externe) active : le moteur d'extraction et
  la couche semantique sont a base de regles explicites et modifiables
  (`config/extraction_patterns.json`, `config/statut_patterns.json`), pas un
  modele de langage. `src/semantic-analysis/ai.js` prepare une abstraction
  (`analyzeWithAI`) pour une future implementation reelle, mais reste en
  mode mock : aucun appel reseau, aucune cle API dans le depot.
- Aucune automatisation d'action sociale : les brouillons de commentaire/
  message sont generes mais jamais envoyes automatiquement.
