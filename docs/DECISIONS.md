# Vector — décisions

Questions du responsable produit : `decisions/vector.json` du dépôt Norma (Norma 3.0, 27 nov. 2026), auxquelles il répond
sur la page unique « Suivi Atrium » (https://claude.ai/artifact/Rs7kooJdowShdYUqNS8jQf ; réponses dans sa base, collection
`answers`, relues avant chaque livraison et reportées ici). L'ancienne page de questionnaire de Vector
(`scripts/questionnaire/`) est retirée : ses questions y ont été reprises. Tant qu'une question n'a pas
de réponse, **la proposition par défaut s'applique** : c'est elle que la livraison 1 a construite.

## 1. Décisions déjà prises

| Id | Date | Décision |
| --- | --- | --- |
| P-1 | 24 nov. 2026 | Un nouvel outil de la suite pour le responsable des expéditions (nationales et internationales) du groupe. |
| P-2 | 24 nov. 2026 | Règles communes de la suite (Norma 1.2.0) : PostgreSQL commun, schéma `vector`, rôle `vector_app`, vues `pub_` définies par Matrix, droits lus dans Clavis, documents dans Codex. |
| P-3 | 24 nov. 2026 | Charte Nocturne (Norma), thèmes sombre et clair, français par défaut. |
| P-4 | 24 nov. 2026 | Toute l'interface et le suivi des expéditions sont construits dès la première version (livraison 1), sur des données de démonstration fictives. |
| P-5 | 24 nov. 2026 | Ports sur le Mac du propriétaire : 3900 (Vector) et 3910 (tests), inscrits au registre de Norma (2.1.0, demande DN-1). |

## 2. Réponses du propriétaire

Aucune à ce jour.

## 3. Questions et réponses par défaut

### À traiter en priorité

| Id | Question | Réponse par défaut (appliquée) | Autres choix | Bloque |
| --- | --- | --- | --- | --- |
| N-1 | Le nom de l’outil : « Vector » ? | Vector | Portus (« le port ») ; Navis (« le navire ») ; Un autre nom (le donner en note) | L1 |
| T-1 | Les expéditions passent-elles de Keystone (écran projet R-158) à Vector ? | Oui, par étapes (docs/spec/05-echanges.md § 4) : Vector devient la source des expéditions ; Keystone garde l’Incoterm du contrat, la nomenclature, le contrôle colisage ↔ nomenclature, la réception sur site et les réserves, et affiche les expéditions du projet en lecture avec un lien vers Vector ; Arche lit vector.pub_expeditions (mêmes colonnes). | Non : Keystone garde les expéditions de projet, Vector ne traite que le hors projet (pièces de rechange, retours, achats) ; Vector reprend tout, y compris la réception sur site et les réserves | L2 |
| D-1 | Pour quelles sociétés et quels sites Vector travaille-t-il ? | Au départ, tout ce qui part des sites de l’entreprise (ateliers, magasins) ou d’un fournisseur pour son compte ; une filiale s’ajoute ensuite site par site (le site devient un départ possible, ses utilisateurs reçoivent un rôle Vector dans Clavis). | Tout le groupe dès le départ ; l’entreprise seulement, sans extension prévue | L1 |

### Transition depuis Keystone

| Id | Question | Réponse par défaut (appliquée) | Autres choix | Bloque |
| --- | --- | --- | --- | --- |
| T-2 | Que deviennent les documents d’expédition déjà générés par Keystone ? | Ils restent dans Codex tels quels ; Vector reprend le type SHP pour ses dépôts ; une expédition importée de Keystone garde ses références Codex. | Type documentaire distinct pour Vector | L4 |
| T-3 | Où vit le contrôle colisage ↔ nomenclature d’une expédition de projet ? | Dans Keystone, qui lit vector.pub_colis et garde le livrable « Colisage & documents douaniers » ; Vector affiche le résultat lu dans une vue de Keystone. | Dans Vector, qui lit keystone.pub_nomenclatures | L2 |
| T-4 | Où se pointe la réception sur site ? | Dans Keystone pour les expéditions de projet (réserves comprises) ; Vector lit l’état de réception. Dans Vector pour les autres expéditions (le demandeur confirme la réception). | Toujours dans Vector, les réserves envoyées à Keystone par son API | L5 |

### Demandes, transport et suivi

| Id | Question | Réponse par défaut (appliquée) | Autres choix | Bloque |
| --- | --- | --- | --- | --- |
| D-2 | Les enlèvements chez les fournisseurs (achats) passent-ils par Vector ? | Oui quand le transport est à la charge du groupe (Incoterm d’achat E ou F) : l’acheteur crée une demande d’origine « commande d’achat » ; sinon rien dans Vector (le fournisseur livre). | Non, seulement les envois sortants ; Tous les achats, même livrés par le fournisseur (suivi seulement) | L2 |
| D-3 | D’où viennent les demandes de pièces de rechange ? | Le magasin ou le service pièces saisit la demande dans Vector (origine « pièce de rechange », n° de commande du client en texte, urgence) ; un outil de commandes de pièces, s’il vient, créera les demandes par l’API de Vector. | Les commandes de pièces se tiennent dans Keystone (projet « SAV ») ; Les filiales saisissent elles-mêmes leurs demandes dans Vector | L2 |
| D-4 | Groupage : plusieurs demandes dans une expédition ? | Oui, dans les deux sens ; les coûts d’une expédition groupée se répartissent au prorata du poids taxable de chaque demande (D-7). | Une demande = une expédition | L2 |
| D-5 | Au-delà de quel montant une attribution est-elle validée par le responsable des expéditions ? | 10 000 € (réglable dans l’administration) ; une urgence « critique » peut être attribuée sans appel d’offres, avec motif journalisé. | 5 000 € ; Toute attribution validée par le responsable ; Pas de validation | L3 |
| D-6 | Combien de cotations faut-il avant d’attribuer ? | 3 cotations au-delà de 5 000 € estimés, 1 en dessous ; une exception se motive (seuils réglables). | Toujours 3 ; Selon la politique achats (à fournir) | L3 |

### Douane, conformité et documents

| Id | Question | Réponse par défaut (appliquée) | Autres choix | Bloque |
| --- | --- | --- | --- | --- |
| D-9 | Comment se fait le criblage sanctions des destinataires ? | Vérification manuelle tracée dans Vector (qui, quand, quelle liste, résultat, preuve dans Codex), refaite pour chaque nouvel destinataire et au plus tard tous les 6 mois ; la table des pays (embargo, restreint, surveillé) est tenue par le rôle Conformité. | Outil de criblage du groupe (à indiquer), Vector garde le résultat ; Pas de criblage (déconseillé) | L4 |
| D-10 | Marchandises dangereuses : qui signe, et que voit Vigie ? | La déclaration est faite par une personne habilitée (titre lu plus tard dans Cursus) et référencée dans Vector ; toute expédition avec un n° ONU est signalée à Vigie (file d’envoi) ; un incident de transport de marchandises dangereuses ouvre un événement dans Vigie. | Rien vers Vigie, Vector seul ; Validation préalable obligatoire par le QHSE dans Vigie | L4 |
| D-12 | Quels documents Vector génère-t-il ? | Liste de colisage, liste par conteneur, marques de colis, instructions d’expédition, CMR, VGM et facture proforma (valeur douane, jamais la facture comptable) ; gabarits génériques jusqu’aux modèles de l’entreprise ; tout est déposé dans Codex. | Les mêmes sans la facture proforma ; Aucun : seulement des références aux documents faits ailleurs | L4 |
| D-18 | Lettres de crédit : jusqu’où Vector les suit-il ? | Vector porte la LC de l’expédition (n°, banque, date limite d’expédition, validité, documents exigés et leurs mentions) et contrôle les dates et la liste ; la présentation à la banque reste à la trésorerie. | Rien dans Vector ; Vector prépare aussi le dossier de présentation à la banque | L4 |

### Coûts et performance

| Id | Question | Réponse par défaut (appliquée) | Autres choix | Bloque |
| --- | --- | --- | --- | --- |
| D-7 | Comment imputer le coût d’une expédition groupée ? | Au prorata du poids taxable de chaque demande ; le responsable peut corriger la répartition à la main, avec motif. | Au prorata de la valeur ; Au prorata du volume ; Saisie à la main seulement | L5 |
| D-8 | Devises et cours de change | Tout est comparé et cumulé en euros ; les cours se saisissent chaque semaine par la finance dans Vector (table des cours) ; ils seront lus dans Sage ou dans une publication commune quand elle existera. | Lire les cours d’Arche (vue à demander) ; Cours de la BCE importés (demande DSI : appel extérieur) | L3 |
| D-11 | Comment noter les transporteurs ? | Ponctualité 40 %, incidents 25 %, écart facture / cotation 20 %, réactivité aux appels d’offres 15 % (pondérations réglables) sur 12 mois glissants, affichée à partir de 5 expéditions. | Ponctualité seule ; Pondérations à donner | L5 |
| D-13 | Faut-il estimer les émissions de CO₂ des expéditions ? | Plus tard : la colonne et le calcul sont prévus ; activés quand la direction fournit les facteurs et la méthode. | Oui dès la livraison 5 ; Non | L5 |
| D-17 | Assurance transport | Police annuelle du groupe par défaut (n° et assureur dans l’administration), valeur assurée = valeur CIF × 110 % ; police spécifique pour un envoi hors conditions (valeur, pays). | Une assurance par envoi ; Pas d’assurance du groupe (acheteur) | L5 |

### Connecteurs et services extérieurs

| Id | Question | Réponse par défaut (appliquée) | Autres choix | Bloque |
| --- | --- | --- | --- | --- |
| D-14 | Suivi automatique des transports (API) ? | Saisie à la main au départ ; connecteur simulé prêt ; branchement réel d’un fournisseur après accord de la DSI et si le volume le justifie. | Branchement dès la livraison 3 (fournisseur à choisir) ; Jamais | L6 |
| D-15 | Les transporteurs saisissent-ils eux-mêmes (portail) ? | Non au départ : les appels d’offres partent par e-mail (texte préparé) et les réponses sont saisies par l’équipe ; un lien de réponse à usage unique pourra être étudié avec la DSI. | Portail dès la livraison 3 | L3 |
| D-16 | Colis express : un agrégateur (Sendcloud, Boxtal…) ? | Non au départ : l’étiquette se fait sur le site de l’intégrateur, Vector garde l’expédition, le n° de suivi et le coût. | Agrégateur à choisir avec la DSI | L6 |
| D-19 | Les factures de fret viennent-elles de Sage ? | Oui, par la même méthode : extraction Sage des factures fournisseurs des comptes de transport déposée dans un dossier (VECTOR_SAGE_DIR), rapprochée par n° de réservation ou d’expédition ; saisie à la main en attendant. | Saisie à la main seulement ; Lecture d’une vue Sage sur le serveur | L6 |

### Utilisateurs et droits

| Id | Question | Réponse par défaut (appliquée) | Autres choix | Bloque |
| --- | --- | --- | --- | --- |
| U-1 | Rôles de Vector (lus dans Clavis, cumulables) | Manager (responsable des expéditions), Coordinator, Requester (demandeur), Packing (magasin / emballage), Finance, Compliance (douane et conformité), Reader, Admin. | Sans le rôle Compliance (le responsable des expéditions s’en charge) ; Ajouter un rôle « assistant(e) expéditions » | L1 |
| U-2 | Qui voit les valeurs marchandes et les coûts ? | Manager, Coordinator, Finance, Compliance, Admin ; pas les demandeurs, le magasin ni la lecture. | Aussi les demandeurs pour leurs propres expéditions ; Seulement Manager et Finance | L1 |
| U-3 | Un demandeur voit-il toutes les expéditions ? | Ses demandes et les expéditions qui les portent, plus celles des projets dont il fait partie (lu dans Keystone plus tard) ; le reste en liste sans détail. | Toutes, sans valeurs ni coûts | L2 |

### Données à fournir

| Id | Donnée | Modèle |
| --- | --- | --- |
| DA-1 | Transporteurs, transitaires, emballeurs, assureurs habituels | Modèle docs/donnees/01-partenaires.csv : raison sociale, pays, type, modes, zones, contacts professionnels. |
| DA-2 | Sites de départ, magasins et adresses d’enlèvement | Modèle docs/donnees/02-sites-et-adresses.csv (complète matrix.pub_sites : heures d’ouverture, quai, capacité de levage). |
| DA-3 | Codes SH utilisés et désignations douanières validées | Modèle docs/donnees/03-codes-sh.csv ; reprendre ceux des articles de Keystone, à valider par le transitaire ou la douane. |
| DA-4 | Politique Incoterms du groupe | Modèle docs/donnees/04-politique-incoterms.csv : Incoterm par type de vente, de client, de destination. |
| DA-5 | Standards d’emballage | Modèle docs/donnees/05-emballages.csv : caisses types, palettes, conteneurs, normes (HPE, NIMP 15). |
| DA-6 | Pays : risques, embargos, accords d’origine | Modèle docs/donnees/06-pays.csv ; à valider par la conformité. |
| DA-7 | Standards de coût et historique de 12 mois d’expéditions | Modèle docs/donnees/07-standards-couts.csv et 08-historique-expeditions.csv (tableur actuel) : estimation et indicateurs de départ. |
| DA-8 | Modèles de documents de l’entreprise | Packing list, facture proforma, marques, instructions d’expédition actuels (fichiers à déposer dans Codex). |

## 4. Choix faits sans demander (livraison 1)

| Id | Choix | Pourquoi |
| --- | --- | --- |
| C-1 | Facteurs de poids taxable : aérien 1:6000, express 1:5000, groupage maritime 1 t = 1 m³, routier 1:3 (333 kg / m³) | usages courants du marché ; réglables par l'administration |
| C-2 | Gabarits de conteneur (dimensions intérieures usuelles) et plateau routier 13,60 m / 24 t | ordre de grandeur standard ; réglables |
| C-3 | Tolérance de ponctualité 1 jour ; seuil d'écart facture / cotation 5 % ; colis lourd ≥ 10 t | à confirmer à l'usage |
| C-4 | Délais de réclamation : CMR 7 jours (avarie non apparente), Montréal 14 / 21 jours, La Haye-Visby 3 jours | conventions internationales usuelles ; à valider par le juriste |
| C-5 | Les statuts publiés à Keystone et Arche suivent le vocabulaire R-158 (`draft` … `closed`) | contrat `pub_expeditions` repris sans changement |
| C-6 | Données de démonstration entièrement fictives (projets `DEMO-…`, sites « Atelier Nord », mines inventées, transporteurs « Transports Alpha »…) | aucune personne ni société réelle |
