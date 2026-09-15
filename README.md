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
  cli.js           Interface en ligne de commande
/tests       Tests par moteur + scenarios de bout en bout (Tests A a G) + tests API/serveur/extraction
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
  "texte" et le resultat "formulaire manuel" sur les memes signaux.

Les tests serveur utilisent un fichier de donnees temporaire
(`PROSPECTS_FILE`) : ils ne touchent jamais a `data/prospects.json`.

## Ce qui n'est pas fait en V1 (par choix)

- Aucune automatisation LinkedIn (envoi, scraping, commentaires).
- Aucune integration CRM / Notion / Google Sheets (prevue pour la V2).
- Aucune extraction automatique de signaux depuis un texte brut par IA : les
  signaux sont saisis explicitement pour rester audités et fiables.
- Pas de gestion multi-utilisateur ni d'authentification (outil local,
  usage personnel).
