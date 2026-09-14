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
npm run cli -- <commande>   # ou directement : node src/cli.js <commande>
```

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

## Structure du projet

```
/config      Regles metier (ICP, scoring, offres, signaux, seuils, pipeline)
/data        Donnees persistees (prospects.json, interactions.json)
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
  cli.js           Interface en ligne de commande
/tests       Tests par moteur + scenarios de bout en bout (Tests A a G)
/docs        architecture.md, assumptions.md
```

## Tests

`npm test` lance :
- les tests unitaires de chaque moteur (scoring, qualification, temperature,
  offer_matching, deduplication, pipeline) ;
- les 7 scenarios de bout en bout du cahier des charges (Tests A a G :
  HOT, WARM sans intention, IGNORE debutant, VISIBILITE, SERENITE, LIBERTE,
  informations insuffisantes) ;
- un test d'evolution du score/temperature dans le temps.

## Ce qui n'est pas fait en V1 (par choix)

- Aucune automatisation LinkedIn (envoi, scraping, commentaires).
- Aucune integration CRM / Notion / Google Sheets (prevue pour la V2).
- Aucune extraction automatique de signaux depuis un texte brut par IA : les
  signaux sont saisis explicitement pour rester audités et fiables.
