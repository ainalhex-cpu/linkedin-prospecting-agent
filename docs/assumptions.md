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

## V2 — decouverte, analyse semantique, opportunite, priorite, briefing

17. **Un quatrieme statut ICP, `A_VERIFIER`, en plus des trois du brief
    (ICP_PRINCIPAL / ICP_SECONDAIRE / HORS_ICP).** Le brief V2 (section 11)
    ne nomme que trois categories, mais son propre principe directeur
    ("ne jamais inventer") s'applique aussi a la qualification ICP : quand
    aucune preuve suffisante n'existe (ni activite propre confirmee, ni
    statut salarie detecte), le systeme ne doit pas plus inventer un
    HORS_ICP (l'absence de preuve n'est pas la preuve du contraire) qu'un
    ICP_PRINCIPAL. `A_VERIFIER` comble ce cas, exactement comme le brief le
    demande deja pour le contexte d'un signal ("Contexte non determine",
    section 5). Consequence directe sur le pont vers le scoring V1 : un
    profil `A_VERIFIER` NE recoit PAS le bonus FIT "coach business"
    (uniquement PRINCIPAL/SECONDAIRE), et sa priorite plafonne a B (jamais
    A, meme avec une opportunite forte) — voir `src/priority/index.js`.

18. **Statut salarie = disqualifiant absolu, y compris pour un excellent
    vocabulaire "coach".** Conformement a la section 6/11 du brief V2, des
    qu'un statut salarie est detecte (ex: "chez AFTRAL", "en alternance",
    "poste salarie"), `icp_assessment.qualification` vaut HORS_ICP quel que
    soit le reste du texte, ce qui active `signals.exclusion.hors_cible`
    (champ V1 deja existant mais jamais cable avant la V2) et produit une
    temperature IGNORE via le moteur existant, sans nouvelle logique
    d'exclusion.

19. **Detection du statut salarie : marqueurs explicites uniquement, jamais
    par defaut.** Un profil sans aucun marqueur de statut (ni salarie, ni
    independant/fondateur/dirigeant) reste `statut: 'inconnu'`, ce qui ne
    bloque PAS une qualification ICP_PRINCIPAL/SECONDAIRE si une activite
    propre est par ailleurs demontree (ex: "j'ai lance mon entreprise" sans
    le mot "fondateur"). Etre exhaustif sur la detection de statut est moins
    important qu'eviter un faux "salarie" qui exclurait a tort un
    independant qui ne l'a pas explicitement precise.

20. **Le garde-fou "probleme du prospect vs. probleme de ses clients"
    s'applique aux categories PROBLEME et INTENTION, jamais a MATURITE.**
    "Mes clients ont une organisation chaotique" ne doit jamais devenir le
    probleme du prospect (retire du scoring, section 9), mais reste une
    preuve legitime qu'il A des clients (`maturite.clients_audience_etablis`
    n'est pas concernee par le garde-fou) : l'existence de clients et la
    nature de leurs problemes sont deux faits independants.

21. **Priorite A_VERIFIER + opportunite forte -> priorite B, jamais A.** Le
    brief ne donne que 3 exemples de priorite (section 12). Choix : un
    signal d'intention fort sans FIT confirme merite un coup d'oeil humain
    (B) plutot que d'etre enterre (C) ou traite comme un exclu (IGNORE,
    reserve au HORS_ICP confirme), mais ne peut jamais atteindre A sans un
    ICP confirme — la priorite A est reservee a un FIT ET une opportunite
    tous deux etablis.

22. **Seuil de recence : 60 jours, configurable
    (`config/intent_levels.json -> recency_threshold_days`), et neutre par
    defaut.** Le brief (section 14) ne fixe pas de duree. Choisi comme
    ordre de grandeur raisonnable pour un signal de type "je cherche un
    prestataire" reste actionnable. Sans date de signal fournie (cas de
    tous les textes colles a la main aujourd'hui, qui n'ont pas de date de
    publication structuree), l'action du moteur existant n'est JAMAIS
    penalisee : la recence ne peut que retrograder une action, jamais en
    inventer une meilleure ni en degrader une par defaut faute de date.

23. **Une seule date de signal par texte analyse, pas par phrase.** Le
    brief (section 14) demande que chaque signal puisse avoir une date. En
    l'absence de dates par phrase dans un texte colle a la main (LinkedIn
    n'expose pas cette metadonnee a la copie), la V2 accepte une date
    optionnelle unique (`date_publication`) appliquee a l'ensemble des
    preuves d'un meme texte. Suffisant pour le cas d'usage actuel (analyser
    un post ou un profil a un instant donne) ; une source structuree future
    (section 15/23 de la V2, ou une API autorisee) pourrait dater chaque
    signal individuellement sans changer `src/actions/computeActionV2`.

24. **Discovery V2 : jeu de donnees mock fixe en memoire, pas de fichier de
    configuration separe.** Le brief demande explicitement une source MOCK
    pour cette V2 (section 15), pas une vraie recherche. Les quelques
    profils types (coach etabli avec/sans intention, formateur independant/
    salarie, salarie qui recrute, debutant) couvrent directement les
    scenarios de test requis (section 23) et servent de demonstration du
    workflow complet. Remplacer cette source par une API autorisee plus
    tard ne touche que `src/discovery/index.js`.
