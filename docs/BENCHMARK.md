# Vector — benchmark des outils du marché

> Rédigé le 24 novembre 2026 **de mémoire** (connaissances générales de Claude sur ces produits, sans consultation de
> leurs sites ni de leurs offres à cette date). Aucun prix n'est donné : les éditeurs les fixent au devis et ils changent
> souvent. Les fonctions citées sont celles connues publiquement ; elles sont à confirmer par une démonstration si l'une de
> ces offres est envisagée à la place de Vector ou à côté.

## 1. Le besoin d'EPC2i, en une phrase

Expédier depuis les ateliers et fournisseurs d'Europe vers des sites miniers du monde entier (Afrique, Amérique du Sud,
Australie, Moyen-Orient…) : des **machines** (unités mobiles, modules de production, souvent hors gabarit), des **caisses**
de pièces et d'équipements de site, des **conteneurs** complets, du **breakbulk** (colis lourds sur le pont ou en cale),
des **pièces de rechange urgentes** par avion ou express, et parfois des **retours de site** (matériel en réparation,
outillage). Avec : Incoterms, déclaration d'export (EX-A / MRN), origine préférentielle (EUR.1, certificat d'origine),
crédit documentaire (lettres de crédit), contrôle des biens à double usage et des sanctions, marchandises dangereuses
(produits chimiques, gaz, batteries, parfois matières liées aux explosifs : ADR / IMDG / IATA), assurance, et une imputation
des coûts au projet.

Volume probable : quelques centaines d'expéditions par an, peu de colis standards, beaucoup de cas particuliers. C'est un
profil de **logistique de projet** (« project cargo ») plus que de distribution.

## 2. Familles d'outils

| Famille | Exemples | Ce qu'ils font bien | Limite pour EPC2i |
| --- | --- | --- | --- |
| **TMS d'entreprise** | SAP TM, Oracle OTM (Transportation Management), Descartes (TMS, routage) | planification et optimisation de flux réguliers, appels d'offres de fret annuels, facturation et rapprochement fret, multi-modes, intégration ERP | lourds à déployer, pensés pour des flux répétitifs ; ERP SAP / Oracle supposé (EPC2i est sur Sage) |
| **Bourses et plateformes de fret routier** | Alpega (Teleroute, Wtransnet), Transporeon (plateforme d'appels d'offres et de réservation de créneaux) | mise en concurrence des transporteurs routiers, réservation de quais, suivi | routier européen surtout ; peu pour le maritime projet |
| **Visibilité temps réel** | project44, Shippeo, FourKites | ETA prédictive, suivi multi-transporteurs par API / télématique, alertes de retard, ports et navires | abonnement par volume, l'intérêt dépend de transporteurs connectés ; peu utile pour du breakbulk vers un port africain sans données |
| **Transitaire / commissionnaire et douane** | CargoWise (WiseTech), Descartes Customs, Conex (logiciel de dédouanement), DELTA G / DELTA X (téléprocédures de la douane française), ICS2 (sûreté import UE) | dossier d'expédition complet côté transitaire, dédouanement, connaissements, taxes | ce sont les outils **du transitaire** : EPC2i n'est pas commissionnaire en douane ; elle a besoin d'en suivre le résultat (MRN, EX-A, bon à enlever) |
| **Multi-transporteurs colis** | Sendcloud, Boxtal, ShipStation | étiquettes, comparaison de tarifs colis et express, suivi, retours | parfait pour la pièce urgente de < 70 kg ; rien pour une caisse de 8 t |
| **Places de marché de cotation** | Freightos (et sa plateforme WebCargo pour l'aérien) | cotation instantanée conteneur et aérien, réservation en ligne | tarifs spot standard ; pas de hors gabarit, pas de site minier en bout de chaîne |
| **Colisage et emballage** | logiciels de calcul de chargement (empotage 3D de conteneurs), outils des emballeurs industriels | plan d'empotage, taux de remplissage, centre de gravité | souvent un outil à part chez l'emballeur ; EPC2i a besoin du résultat (poids, dimensions, plan) |
| **Marchandises dangereuses** | modules DG des TMS, logiciels de rédaction de déclarations (DGD, déclaration IMDG, Shipper's Declaration IATA) | contrôle de compatibilité, ségrégation, marquage, documents | réservé à des déclarants formés ; à cadrer avec le conseiller à la sécurité (CSTMD) et Vigie |

## 3. Matrice des fonctions

Légende : ● cœur de l'offre · ◐ partiel ou module · — absent ou hors sujet. Colonne « EPC2i » : pertinence pour le besoin
du § 1 (★★★ indispensable, ★★ utile, ★ plus tard, — non).

| Fonction | TMS (SAP TM, OTM, Descartes) | Plateformes (Alpega, Transporeon) | Visibilité (project44, Shippeo, FourKites) | Transitaire / douane (CargoWise, Conex, DELTA) | Colis (Sendcloud, Boxtal, ShipStation) | Cotation (Freightos) | EPC2i | Dans Vector |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Demande d'expédition depuis un projet, une commande, une pièce | ◐ (depuis l'ERP) | — | — | ◐ | ◐ | — | ★★★ | L2 |
| Colisage : caisses, dimensions, poids, volume, contenu | ● | — | — | ● | ◐ | ◐ | ★★★ | L2 |
| Poids taxable (aérien 1:6000, maritime 1 t = 1 m³, routier 1:3) | ● | ◐ | — | ● | ● | ● | ★★★ | L2 |
| Hors gabarit, breakbulk, plan de chargement | ◐ | — | — | ◐ | — | — | ★★★ | L2 (saisie), plan 3D non |
| Annuaire transporteurs et transitaires | ● | ● | ◐ | ● | ● | ● | ★★★ | L3 |
| Appel d'offres ponctuel (RFQ) et comparaison | ● | ● | — | ◐ | ● (tarifs) | ● | ★★★ | L3 |
| Contrats tarifaires annuels, grilles | ● | ● | — | ● | ● | ◐ | ★ | plus tard |
| Réservation (booking, cut-off, navire, vol) | ● | ● | — | ● | ● | ● | ★★★ | L3 (saisie) |
| Suivi par jalons et ETA | ● | ◐ | ● | ● | ● | ◐ | ★★★ | L3 (saisie, API plus tard) |
| ETA prédictive, suivi automatique | ◐ | ◐ | ● | ◐ | ◐ | — | ★ | plus tard (D-14) |
| Incoterms : partage des tâches et des coûts | ● | — | — | ● | — | ◐ | ★★★ | L2 |
| Documents : packing list, facture proforma / commerciale, CMR, B/L, AWB | ● | ◐ | — | ● | ◐ (étiquettes) | — | ★★★ | L4 (génération, dépôt Codex) |
| Déclaration d'export (EX-A, MRN), suivi douane | ◐ | — | — | ● | ◐ | — | ★★★ | L4 (suivi, pas de télédéclaration) |
| Classement tarifaire SH / NC, origine | ● | — | — | ● | ◐ | — | ★★★ | L4 |
| Contrôle double usage et sanctions | ● (GTS) | — | — | ◐ | ◐ | — | ★★★ | L4 (liste de contrôle) |
| Lettre de crédit : documents exigés, présentation | ◐ (trade finance) | — | — | ◐ | — | — | ★★ | L4 |
| Marchandises dangereuses (ADR / IMDG / IATA) | ◐ | — | — | ◐ | ◐ | — | ★★ | L4 (déclaration, lien Vigie) |
| Assurance ad valorem | ◐ | — | — | ● | ◐ | ◐ | ★★ | L5 |
| Incidents, avaries, réclamations | ◐ | — | ◐ | ● | ◐ | — | ★★★ | L5 |
| Preuve de livraison, réception sur site | ◐ | ◐ | ● | ◐ | ● | — | ★★★ | L5 (avec Keystone) |
| Coût prévu / devisé / facturé, imputation | ● | ◐ | — | ● | ● | ◐ | ★★★ | L5 |
| Rapprochement des factures transporteur | ● | ◐ | — | ● | ◐ | — | ★★ | L6 (Sage) |
| Performance transporteurs (délais, avaries, réactivité) | ● | ● | ● | ◐ | ◐ | — | ★★ | L5 |
| Tableaux de bord, KPI, exports | ● | ● | ● | ● | ● | ◐ | ★★★ | L5 |
| Calendrier des départs et cut-offs | ● | ● | ◐ | ● | — | — | ★★ | L3 |
| Portail transporteur (le transporteur saisit) | ◐ | ● | ● | — | — | ● | ★ | plus tard (D-15) |
| Optimisation de tournées | ● | ◐ | — | — | — | — | — | non |
| Gestion d'entrepôt (WMS) | ◐ | — | — | — | — | — | — | non (hors périmètre) |

## 4. Ce qu'on en retient pour Vector

1. **Logistique de projet, pas distribution.** L'optimisation de tournées et les grilles tarifaires annuelles des TMS ne
   servent pas ; la mise en concurrence ponctuelle (RFQ) d'un transitaire par expédition, si.
2. **EPC2i n'est pas transitaire.** Vector ne télédéclare pas (DELTA G / DELTA X, ICS2) : il prépare les données (SH,
   origine, valeur, poids), les remet au transitaire et **suit** le résultat (MRN, EX-A, bon à embarquer). C'est le
   partage habituel avec un commissionnaire en douane.
3. **La caisse est l'objet central.** Dimensions, poids brut / net, contenu, SH, origine, valeur, marques : tout le reste
   (poids taxable, taux de remplissage, packing list, douane, assurance) en découle. Les TMS d'entreprise la traitent mal
   pour du hors gabarit ; Vector la traite en premier.
4. **La checklist documentaire est le vrai gain.** Selon le mode, la destination, l'Incoterm et le paiement (lettre de
   crédit), la liste des documents change ; une erreur sur un document de LC bloque le paiement. Une règle pure, testée,
   qui calcule la liste attendue et ce qui manque.
5. **La visibilité temps réel est un plus, pas un départ.** Le suivi se fait d'abord par jalons saisis (depuis les
   e-mails du transitaire) ; un branchement project44 / Shippeo ou les API des compagnies maritimes se pose plus tard si
   le volume le justifie (question D-14), et après accord de la DSI (aucune donnée ne sort sans elle).
6. **Le colis express a ses outils.** Pour les pièces urgentes de petit poids, Vector enregistre l'expédition et le numéro
   de suivi ; l'étiquette reste faite sur le site de l'intégrateur (DHL, UPS, FedEx…) ou d'un agrégateur (Sendcloud,
   Boxtal) si la DSI en valide un (question D-16).
7. **Un outil de la suite plutôt qu'un progiciel.** Les données qui comptent (projets, nomenclatures, articles, sites,
   documents, droits, incidents HSE) sont déjà dans Keystone, Codex, Matrix, Clavis et Vigie ; un TMS du marché devrait
   les recopier. Vector les lit par les vues `pub_` et ne garde que l'expédition.
