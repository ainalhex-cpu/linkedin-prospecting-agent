# Agent de prospection LinkedIn — Dina

V1 du "cerveau" d'un agent de prospection : identifier, qualifier, scorer,
classer et suivre dans le temps des prospects pour une activite de bras droit
operationnel pour coachs & formateurs (positionnement Visibilite ·
Operations · Experience client).

Cette V1 **n'automatise rien sur LinkedIn** (pas d'envoi de messages, pas de
scraping, pas de commentaires automatiques). Elle sert a raisonner sur des
prospects deja identifies, avec des donnees saisies manuellement (ou
importees plus tard depuis une source autorisee).

Voir `docs/architecture.md` pour le detail technique et `docs/assumptions.md`
pour les hypotheses prises pendant la construction.

## Prerequis

- Node.js >= 20 (aucune dependance externe a installer)

## Lancer le projet

```bash
npm test          # lance tous les tests (node:test)
npm run serve     # lance l'interface web locale sur http://localhost:4173
npm run cli -- <commande>   # ou directement : node src/cli.js <commande>
```

## Interface web (V1)

`npm run serve` (ou `node src/cli.js serve`) demarre un petit serveur HTTP
local (Node natif, aucun framework) qui sert une interface a une page sur
`http://localhost:4173`. Elle permet, sans toucher a la CLI :

1. **Nouveau prospect** — un formulaire (informations, signaux observes
   coches depuis le catalogue de `config/signals.json`, faits observes,
   hypotheses, sources) puis un bouton "Analyser le prospect" qui cree la
   fiche et lance l'analyse en une seule etape.
2. **Resultat de l'analyse** — score detaille (FIT/MATURITE/PROBLEME/
   INTENTION/TOTAL), temperature, signaux d'intention si HOT, besoin detecte
   (probleme principal/secondaire, niveau de confiance, faits vs hypotheses),
   offre recommandee justifiee, action recommandee justifiee, prochaine
   action.
3. **Pipeline** — tableau de tous les prospects, triable par score, par
   temperature ou par date de derniere analyse ; clic sur une ligne pour
   ouvrir la fiche complete.
4. **Top prospects** — les prospects les plus prioritaires du jour.
5. **Fiche prospect** — informations, analyse courante, historique du score,
   historique de temperature, interactions, et un bouton pour relancer
   l'analyse (utile pour marquer un nouvel evenement).

## Analyser un profil LinkedIn a partir d'un texte colle (V1.1)

Nouvelle vue **"🔍 Analyser un profil LinkedIn"** : collez le contenu
disponible sur un profil (description, experiences, derniers posts...), et
le moteur d'extraction (`src/extraction/`) detecte automatiquement les
signaux reellement presents dans le texte — sans jamais en inventer un
seul — puis les transmet **au moteur de qualification/scoring existant**,
inchange (`src/qualification`, `src/scoring`, `src/temperature`,
`src/offer_matching`). Aucune regle metier n'a ete dupliquee ni modifiee
pour cette fonctionnalite.

Le resultat affiche exactement les memes blocs que l'analyse manuelle
(score, temperature, besoin detecte, offre, action), plus deux ajouts :
- **"Pourquoi ce resultat ?"** — pour chaque signal detecte, la phrase
  exacte du texte qui le justifie et son impact sur le score existant
  (ex. `+5 points INTENTION`), ou "hypothese, non retenu" si le signal
  n'etait pas assez explicite pour etre applique automatiquement.
- **Confiance globale de l'extraction** (ÉLEVÉ / MOYEN / FAIBLE) — indique
  la qualite des donnees disponibles dans le texte fourni. Cette confiance
  n'affecte jamais le score : elle informe seulement l'utilisateur.

Toujours aucune connexion a LinkedIn : le texte est colle a la main.
L'entree (aujourd'hui un texte libre) est isolee dans une seule fonction
(`extractFromText`) pour pouvoir etre remplacee plus tard par une source
de donnees autorisee sans toucher au moteur.

L'interface ne fait qu'appeler les memes moteurs que la CLI (via
`src/server/api.js`, une couche de service partagee) : aucune regle metier
n'a ete dupliquee ou modifiee pour la construire. Les donnees restent dans
`data/prospects.json` (aucune nouvelle base ajoutee). Elle n'automatise
toujours rien sur LinkedIn : c'est un outil de saisie et de decision, pas
un robot.

## V2 — Prospection assistee (decouverte, analyse semantique, priorite, briefing)

La V2 fait passer le systeme de *"je colle un profil, le systeme analyse"* a
*"le systeme decouvre/analyse/qualifie/priorise des prospects et me presente
les actions a faire"* — sans jamais automatiser d'action sociale (pas de
connexion LinkedIn, pas de scraping, pas d'envoi automatique).

**Le moteur existant (V1) reste la source de verite pour le score et la
temperature.** La V2 ajoute des couches AUTOUR de lui, jamais a la place :

```
SOURCE (mock)  ->  DISCOVERY  ->  SEMANTIC ANALYSIS  ->  QUALIFICATION/SCORING
(src/discovery)   (src/semantic-analysis)             EXISTANTS (inchanges)
                                                              |
                                                              v
                                          OPPORTUNITY  ->  PRIORITY  ->  ACTION V2
                                        (src/opportunity)  (src/priority) (src/actions)
                                                              |
                                                              v
                                                       PIPELINE (existant) + BRIEFING
```

- **`src/semantic-analysis/`** enrichit l'extraction V1.1 (regex, gardee
  comme "couche complementaire") avec une comprehension de CONTEXTE :
  statut professionnel (fondateur/dirigeant/independant/salarie/...),
  activite propre demontree ou non (jamais un simple titre de poste), etat
  de l'offre (CONFIRMEE/PROBABLE/NON_IDENTIFIEE), et un garde-fou essentiel
  : un probleme mentionne pour "mes clients" n'est jamais attribue au
  prospect lui-meme. Elle determine aussi le contexte d'un signal ambigu
  ("je recrute" = salarie interne, freelance/prestataire, associe, ou non
  determine) — sans jamais inventer quand ce n'est pas clair.
- **FIT, INTENTION et OPPORTUNITE sont trois dimensions independantes**
  (`src/opportunity/`) : un excellent FIT sans intention reste une
  opportunite faible (nurture) ; une intention forte chez un profil hors
  ICP reste une opportunite faible aussi (le fit doit etre reel).
- **La qualification ICP est revue** : ICP_PRINCIPAL (coach business/
  entrepreneuriat independant avec activite propre), ICP_SECONDAIRE
  (formateur/expert/consultant independant, activite propre + offre
  confirmees), HORS_ICP (salarie, debutant sans activite reelle...), ou
  A_VERIFIER (jamais invente quand l'information manque). Le pont vers le
  scoring existant (`config/scoring.json`, inchange) n'accorde le critere
  FIT "coach business/entrepreneuriat" (15 pts) que si l'ICP est confirme
  avec une activite propre demontree — jamais sur un mot-cle isole.
- **Priorite operationnelle** (`src/priority/`) : A/B/C/IGNORE, distincte du
  score. Un excellent FIT sans intention (ex: coach etabli qui ne cherche
  rien) reste priorite B — interessant, mais pas urgent.
- **Recence des signaux** (`src/actions/`) : un signal d'intention trop
  ancien retrograde l'action d'un cran (CONVERSATION -> WARM_UP -> NURTURE),
  sans jamais modifier le score ni l'historique existant.
- **Brouillons de commentaire/message** (jamais envoyes automatiquement,
  toujours a valider par l'utilisateur), proposes seulement quand
  l'opportunite est reellement forte.
- **`src/discovery/`** : source MOCK uniquement pour cette V2 (aucune
  connexion LinkedIn). `discoverProspects({ country, type, limit })` renvoie
  des prospects bruts ; l'architecture permet de brancher plus tard une
  source autorisee sans changer le reste du pipeline.
- **`src/briefing/`** : genere le briefing quotidien, groupe par priorite.

### Lancer le workflow

```bash
npm run prospect                                 # decouvre, analyse et priorise (mock, France par defaut = tout)
node src/cli.js prospect --country France --type coach_business --limit 10
```

Affiche : prospects trouves, nouveaux, doublons, analyses par temperature
(HOT/WARM/COLD/IGNORE), et le top des priorites.

### Lancer le briefing

```bash
npm run briefing
```

Genere le texte du briefing du jour (🔥 a regarder en priorite, 🟠 a
rechauffer, 🔵 a surveiller, ❌ ignores + raisons).

### Dans l'interface

Deux nouvelles vues : **"📅 Prospection du jour"** (bouton "Analyser les
nouveaux prospects", avec filtres pays/limite) et **"🗞️ Briefing"**. La
fiche prospect affiche desormais un bloc **"Signals (V2)"** qui explique la
qualification ICP, le statut professionnel, l'activite propre, le niveau
d'intention/opportunite, et le detail signal/preuve/confiance/contexte
utilise — pour toujours voir *pourquoi* un prospect a telle priorite.

### Abstraction IA (preparee, non activee)

`src/semantic-analysis/ai.js` expose `analyzeWithAI(text)`, une abstraction
pour brancher plus tard un modele de langage. Aujourd'hui : implementation
MOCK uniquement, aucun appel reseau, aucune cle API dans le depot. Utiliser
un vrai provider est une decision explicite a prendre plus tard.

## Commandes CLI

### Ajouter un prospect

Preparer un fichier JSON avec les champs voulus (voir `src/schema/prospect.js`
pour la liste complete des champs et `data/prospects.json` pour le format de
stockage). Exemple minimal :

```json
{
  "nom": "Dupont",
  "prenom": "Marie",
  "entreprise": "MD Coaching",
  "pays": "France",
  "url_linkedin": "https://www.linkedin.com/in/marie-dupont",
  "activite": "Coach business",
  "faits_observes": ["Publie 2x/semaine sur LinkedIn", "A mentionne chercher un prestataire pour ses relances clients"],
  "hypotheses": ["Pourrait manquer de temps pour le suivi client"],
  "signals": {
    "fit": { "coach_business_entrepreneuriat": true, "activite_etablie": true, "marche_francophone": true },
    "maturite": { "offre_commercialisee": true, "clients_audience_etablis": true },
    "probleme": { "organisation": true, "experience_client": true },
    "intention": { "recherche_aide_prestataire": true }
  }
}
```

```bash
node src/cli.js add chemin/vers/prospect.json
```

Si un prospect avec la meme URL LinkedIn (ou meme `linkedin_id`, ou meme
combinaison prenom+nom+entreprise) existe deja, la fiche existante est mise a
jour au lieu d'en creer une nouvelle (deduplication automatique).

### Analyser un prospect

```bash
node src/cli.js analyze <id> ["evenement declencheur optionnel"]
```

Calcule (ou recalcule) le score, la temperature, l'offre recommandee et
l'action recommandee, met a jour l'historique si le score ou la temperature a
change, et affiche la fiche au format lisible.

### Consulter le pipeline

```bash
node src/cli.js list          # liste tous les prospects avec statut/score
node src/cli.js top 10        # les 10 prospects prioritaires (hors IGNORE)
node src/cli.js show <id>     # fiche complete au format JSON
```

## Modifier le scoring

Tout le bareme est dans `config/scoring.json` : chaque critere est un objet
`{ key, label, points }` range dans une categorie (`fit`, `maturite`,
`probleme`, `intention`). `key` doit correspondre a une cle booleenne dans
`prospect.signals.<categorie>`. Modifier les points ou ajouter/retirer un
critere ne demande aucun changement de code.

Les seuils de temperature (HOT/WARM/COLD) et le mapping temperature -> action
sont dans `config/thresholds.json`.

## Modifier les offres

`config/offers.json` definit, pour VISIBILITE et SERENITE, la liste des
signaux qui declenchent l'offre, et pour LIBERTE les signaux "extra" qui la
declenchent directement (equipe, plusieurs offres, forte croissance, etc.),
en plus de la regle "VISIBILITE + SERENITE en meme temps = LIBERTE".

Le catalogue complet des signaux disponibles (avec leurs libelles) est dans
`config/signals.json`.

## Modifier l'ICP ou les statuts de pipeline

- `config/icp.json` : cibles principales/secondaires, criteres de maturite,
  pays francophones prioritaires.
- `config/pipeline.json` : liste des statuts valides.

## Modifier les regles d'extraction de texte

`config/extraction_patterns.json` liste, pour chaque signal existant
(memes cles que `config/signals.json`), les expressions (regex simples,
insensibles a la casse et aux accents) qui permettent de le detecter dans
un texte colle, avec un niveau de confiance (`high`/`medium`/`low`).
`apply_min_confidence` fixe, par categorie, le niveau minimal a partir
duquel un signal detecte est realement applique (par defaut `medium` ;
`high` uniquement pour `exclusion`, afin de ne jamais exclure un prospect
sur une base ambigue). Ajouter une tournure de phrase que vos prospects
utilisent souvent ne demande aucune modification du moteur d'extraction ni
du moteur de scoring.

## Structure du projet

```
/config      Regles metier (ICP, scoring, offres, signaux, seuils, pipeline)
/data        Donnees persistees (prospects.json, interactions.json)
/public      Interface web statique (index.html, styles.css, app.js — vanilla JS)
/src
  schema/          Fiche prospect (creation, valeurs par defaut)
  scoring/         Calcul du score /100
  qualification/   Detection des criteres d'exclusion
  temperature/     HOT / WARM / COLD
  offer_matching/  Detection du besoin -> offre recommandee
  deduplication/   Detection de doublons
  pipeline/        Statuts + priorisation (top N)
  analysis/        Orchestrateur (enchaine les moteurs) + formatage de sortie
  store/           Persistance JSON
  server/          api.js (couche de service partagee CLI/web) + server.js (HTTP natif)
  extraction/      Extraction de signaux a partir d'un texte brut colle (V1.1)
  semantic-analysis/  Statut pro, activite propre, contexte, garde-fous (V2)
  opportunity/     FIT / INTENTION / OPPORTUNITE, dimensions independantes (V2)
  priority/        Priorite operationnelle A/B/C/IGNORE (V2)
  actions/         Recence, brouillons de commentaire/message (V2)
  discovery/       Source mock de decouverte de prospects (V2)
  briefing/        Generation du briefing quotidien (V2)
  cli.js           Interface en ligne de commande
/tests       Tests par moteur + scenarios de bout en bout (Tests A a G) + tests API/serveur/extraction/V2
/docs        architecture.md, assumptions.md
```

## Tests

`npm test` lance :
- les tests unitaires de chaque moteur (scoring, qualification, temperature,
  offer_matching, deduplication, pipeline) ;
- les 7 scenarios de bout en bout du cahier des charges (Tests A a G :
  HOT, WARM sans intention, IGNORE debutant, VISIBILITE, SERENITE, LIBERTE,
  informations insuffisantes) ;
- un test d'evolution du score/temperature dans le temps ;
- les tests de la couche de service partagee (`tests/server/api.test.js`) :
  ajout d'un prospect, absence de doublon, analyse, conservation de
  l'historique, priorisation ;
- un test d'integration HTTP (`tests/server/server.test.js`) qui demarre le
  vrai serveur sur un port ephemere et verifie la page HTML, l'API de
  configuration, le cycle add→analyze→list→top en conditions reelles ;
- les tests du moteur d'extraction (`tests/extraction/extraction.test.js`) :
  aucune invention de signal, distinction confiance haute/moyenne (fait) vs
  confiance faible (hypothese, non applique), exclusion reservee a la
  confiance haute, detection du marche francophone via le pays ;
- les 7 scenarios "texte brut" du cahier des charges V1.1
  (`tests/server/analyze_text.test.js`), qui verifient que le texte colle
  produit exactement les memes decisions (score, temperature, offre) que le
  moteur existant, y compris un test explicite qui compare le resultat
  "texte" et le resultat "formulaire manuel" sur les memes signaux ;
- les tests de la couche semantique V2 (`tests/semantic-analysis/`) : les
  17 scenarios du cahier des charges V2 (coach independant etabli, coach
  sans intention, besoin explicite, formateur independant vs salarie,
  salarie qui recrute, contexte de recrutement, recherche de freelance,
  garde-fou "probleme du prospect vs de ses clients" — avec l'exception
  "suivi de mes clients" —, contexte ambigu, activite propre confirmee/non
  demontree) ;
- les tests d'opportunite et de priorite (`tests/opportunity/`,
  `tests/priority/`) : FIT/INTENTION/OPPORTUNITE independants, matrice de
  priorite A/B/C/IGNORE ;
- les tests de recence (`tests/actions/`) : signal ancien retrograde
  l'action, signal recent la conserve, aucune penalite sans date fournie ;
- les tests de decouverte et de briefing (`tests/discovery/`,
  `tests/briefing/`) ;
- le workflow complet de bout en bout (`tests/server/v2_workflow.test.js`) :
  discover -> deduplicate -> analyze -> qualify -> score -> prioritize ->
  save, y compris l'absence de doublon en relancant le workflow.

Les tests serveur utilisent un fichier de donnees temporaire
(`PROSPECTS_FILE`) : ils ne touchent jamais a `data/prospects.json`.

## Ce qui n'est pas fait en V1/V1.1/V2 (par choix)

- Aucune automatisation LinkedIn (envoi, scraping, commentaires, connexion
  directe) : la decouverte V2 utilise une source mock, jamais LinkedIn.
- Aucune integration CRM / Notion / Google Sheets (prevue pour une V3).
- Aucune IA generative active : l'extraction et l'analyse semantique restent
  a base de regles explicites et auditables ; `analyzeWithAI` est une
  abstraction preparee mais non branchee (mock uniquement, pas de cle API).
- Pas de gestion multi-utilisateur ni d'authentification (outil local,
  usage personnel).
- Pas d'envoi automatique de commentaire ou de message : seuls des
  brouillons sont proposes, toujours valides par l'utilisateur.
