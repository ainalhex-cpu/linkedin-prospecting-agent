# Hypotheses et decisions prises sans validation prealable

Conformement au mode de travail demande (section 25 du brief), voici les
hypotheses raisonnables prises pour ne pas bloquer le projet sur des details
secondaires. Aucune n'a d'impact architectural majeur ; elles sont toutes
modifiables via `/config` sans toucher au code.

1. **Mapping signal -> offre.** Le brief liste des "signaux" par offre en
   texte libre (section 9) mais ne donne pas de mapping formel avec les
   6 criteres PROBLEME du bareme de scoring (section 7). Hypothese retenue :
   - `manque_de_temps`, `communication` -> VISIBILITE
   - `organisation`, `operations`, `experience_client`, `besoin_delegation` -> SERENITE
   - toute combinaison VISIBILITE+SERENITE simultanee, OU un signal de
     contexte (`plusieurs_offres`, `forte_croissance`, `lancements_reguliers`,
     `equipe_ou_prestataires`, `besoin_coordination`, `delegation_equipe_prestataires`)
     -> LIBERTE
   A ajuster dans `config/offers.json` si l'usage reel montre un decalage.

2. **Categorie de signaux "contexte".** Le brief mentionne des signaux LIBERTE
   (plusieurs offres, forte croissance, lancements reguliers, equipe/
   prestataires, besoin de coordination) qui ne font partie d'aucune des 4
   categories du bareme de scoring (FIT/MATURITE/PROBLEME/INTENTION). Plutot
   que de forcer ces signaux dans le score (ce qui aurait fausse le total
   /100 promis), ils ont ete places dans une categorie `contexte` a part,
   utilisee uniquement par le moteur de matching d'offre, sans impact sur le
   score. C'est une decision avec un impact structurel modere : documentee ici
   plutot que bloquante.

3. **Cap HOT sans signal d'intention.** Le brief dit qu'un score >= 80 sans
   signal d'intention ne peut pas etre HOT, mais ne precise pas la
   temperature de repli. Hypothese : repli automatique en WARM (configurable
   via `thresholds.json` -> `hot_downgrade_temperature`).

4. **Priorisation (section 16).** Le brief donne un ordre de criteres
   (pertinence ICP, maturite, probleme, intention, facilite de contact,
   recence) sans preciser s'il s'agit d'une somme ponderee ou d'un tri
   lexicographique strict. Hypothese retenue : tri lexicographique strict
   (le score FIT depuis toujours prioritaire, meme si l'ecart est faible),
   car plus fidele a l'ordre explicite "1. 2. 3. ..." du brief qu'une
   ponderation implicite. `facilite_contact` est un champ optionnel
   (0-5, non renseigne par defaut) que l'utilisateur peut remplir a la main.

5. **`marche_francophone` derive automatiquement du pays.** Comme le pays est
   une donnee objective (pas une interpretation), `config/icp.json` liste les
   pays francophones prioritaires ; un futur script d'import pourra en
   deduire `signals.fit.marche_francophone` automatiquement. En V1, ce champ
   reste un signal saisi manuellement comme les autres (aucune automatisation
   silencieuse n'a ete cablee dans le moteur, pour rester previsible et
   testable).

6. **Champ `offre` vs `offre_recommandee`.** Le brief liste un champ `offre`
   dans la fiche prospect (section 11) distinct de "offre recommandee"
   (mentionnee plus loin). Hypothese : `offre` decrit l'offre commerciale
   *du prospect lui-meme* (ce qu'il vend), tandis que `offre_recommandee` est
   le resultat du moteur de matching (VISIBILITE/SERENITE/LIBERTE/NON_IDENTIFIE).

7. **Stockage fichier JSON plutot que base de donnees.** Volume attendu
   (5-10 prospects qualifies/jour, pipeline personnel) ne justifie pas une
   base de donnees en V1. `src/store/prospectStore.js` isole cette decision :
   migrer vers SQLite/Postgres/Notion plus tard ne touche aucun moteur.

8. **CLI minimale plutot qu'interface graphique (V1 du moteur).** Le brief ne
   demandait pas d'UI pour la premiere iteration ("le cerveau du systeme").
   Une CLI (`src/cli.js`) suffisait pour piloter add/analyze/list/top/show.
   Une interface web locale a ete ajoutee dans une iteration suivante
   (voir points 10-12 ci-dessous) ; les integrations externes (Notion, CRM,
   Google Sheets, LinkedIn) restent hors-perimetre (section 23).

10. **"Probleme principal" vs "problemes secondaires" (ajoute pour
    l'affichage du resultat).** Le moteur `offer_matching` detecte une liste
    de signaux qui declenchent une offre, sans notion de hierarchie (tous
    les criteres PROBLEME valent 5 points, section 7). Pour l'affichage
    "besoin detecte" demande par l'interface, le premier signal detecte
    (dans l'ordre de `config/offers.json`) est presente comme "probleme
    principal" et les suivants comme "secondaires". C'est une convention de
    presentation, pas une regle de score : elle n'affecte ni le total, ni la
    temperature, ni l'offre recommandee.

11. **"Niveau de confiance" (ajoute pour l'affichage).** Ni demande dans le
    bareme ni dans le schema d'origine. Regle simple et transparente ajoutee
    dans `src/analysis/index.js` (`assessConfidence`) : "Eleve" si au moins un
    fait observe est renseigne, "Faible" si seulement des hypotheses, "Non
    determine" si aucun des deux. Ne modifie aucun score ; sert uniquement a
    rappeler visuellement la regle "ne jamais presenter une hypothese comme
    un fait" (section 6) au moment de la decision.

12. **Interface web : un seul flux "ajouter + analyser".** Le formulaire
    "Nouveau prospect" appelle un point d'entree combine (`POST /api/analyze`)
    qui fait `addProspect` puis `analyzeExisting` en une seule action, pour
    coller au parcours demande ("j'arrive -> je renseigne -> je clique sur
    analyser -> j'ai une decision claire"). Les endpoints separes
    (`POST /api/prospects`, `POST /api/prospects/:id/analyze`) restent
    disponibles (utilises par la CLI et pour re-analyser une fiche
    existante depuis sa page de detail).

9. **Pas de scoring/qualification automatique par IA a partir de texte brut.**
   La section 22 interdit le scraping agressif et la section 6 interdit
   d'inventer des hypotheses. Faire analyser un profil LinkedIn brut par un
   LLM pour en deduire des signaux introduirait un risque d'hallucination
   difficile a auditer en V1. Les signaux restent donc saisis explicitement
   (a la main ou via un import structure), avec les champs `faits_observes`/
   `hypotheses` pour tracer le raisonnement humain. Ce point pourra etre
   reetudie en V2 avec une supervision humaine systematique.

   *Mise a jour V1.1* : ce point reste vrai pour le scoring/la qualification
   (toujours calcules par les memes moteurs deterministes, jamais par une
   IA). L'extraction de SIGNAUX depuis un texte colle a ete automatisee,
   mais via un moteur a base de regles explicites et auditables
   (`config/extraction_patterns.json`), pas via un LLM ou une API externe —
   voir points 13-16 ci-dessous.

13. **Extraction par regles (regex) plutot que par IA/LLM.** Le brief V1.1
    demandait explicitement de ne pas connecter LinkedIn ni d'API externe.
    Un moteur base sur des expressions regulieres explicites reste
    deterministe (memes entrees -> memes signaux, toujours), modifiable sans
    toucher au code (`config/extraction_patterns.json`), et ne peut jamais
    halluciner un signal absent du texte. Contrepartie assumee : il ne
    comprend que les tournures de phrase couvertes par ses regles ; un texte
    formule tres differemment peut ne rien detecter. C'est un choix
    delibere de fiabilite/auditabilite plutot que de couverture maximale
    pour cette V1.1, ajustable en enrichissant le fichier de patterns.

14. **Seuil de confiance minimal par categorie
    (`apply_min_confidence` dans `config/extraction_patterns.json`).** Un
    signal detecte avec une regle `high` ou `medium` est applique (devient
    un fait, alimente le score) ; un signal `low` reste une hypothese non
    appliquee. Exception : la categorie `exclusion` exige `high` partout,
    pour qu'un texte ambigu ne puisse jamais faire basculer un prospect en
    IGNORE tout seul (l'exclusion reste la decision la plus consequente du
    systeme). Ce seuil est modifiable dans la config sans toucher au code.

15. **Champs texte deduits (`type_prospect`, `activite`, `offre`,
    `audience`) uniquement a partir de citations litterales.** Quand le
    moteur d'extraction remplit ces champs, il reutilise mot pour mot la
    phrase du texte source qui a declenche le signal correspondant (jamais
    une reformulation ou un resume) ; les valeurs saisies explicitement par
    l'utilisateur dans le formulaire restent toujours prioritaires sur
    celles deduites du texte.

16. **Confiance globale de l'extraction : heuristique simple, additive.**
    `computeGlobalConfidence` (dans `src/extraction/index.js`) classe
    l'extraction ÉLEVÉ des qu'au moins deux signaux de confiance haute sont
    appliques, MOYEN avec un signal haute confiance ou deux signaux moyenne
    confiance, FAIBLE sinon (y compris quand rien n'est detecte). C'est une
    indication qualitative pour l'utilisateur, pas une note qui entre dans
    le score /100.
