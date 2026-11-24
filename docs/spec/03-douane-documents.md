# 03 — Douane, conformité export, documents

## 1. Douane export

EPC2i n'est pas commissionnaire en douane : Vector **prépare** les données et **suit** la déclaration faite par le
transitaire ou le commissionnaire (DELTA G / DELTA X en France, système de l'État membre de sortie ailleurs).

| Donnée | Règle |
| --- | --- |
| Procédure | `export` (code régime 10), `temporary_export` (admission temporaire, ATA carnet : outillage, matériel d'essai), `re_export`, `outward_processing` (perfectionnement passif : réparation), `intra_eu` (pas de déclaration, DEB / état récapitulatif à part), `domestic` |
| Déclarant | partenaire `customs_broker` ou `forwarder` |
| MRN | n° de référence du mouvement, `^[0-9]{2}[A-Z]{2}[A-Z0-9]{13}[0-9]$` (18 caractères) |
| EX-A / preuve de sortie | date de sortie, référence Codex du document (« bon à embarquer » / message de sortie ECS) ; exigé avant clôture d'une expédition export (preuve d'exonération de TVA) |
| Classement | code SH par ligne (6 chiffres internationaux, NC à 8 chiffres pour l'UE, 10 pour TARIC si connu) ; une liste des codes SH **utilisés** par le groupe, avec désignation douanière validée (`hs_codes`) |
| Origine | pays d'origine par ligne ; origine préférentielle (EUR.1, EUR-MED, déclaration d'origine sur facture, n° d'exportateur agréé / REX) ou non préférentielle (certificat d'origine de la CCI) selon l'accord avec le pays de destination (table `origin_rules`, à fournir) |
| Valeur | valeur en douane (transactionnelle), devise, Incoterm ; valeur statistique |

## 2. Contrôle de conformité export (`src/domain/compliance.ts`)

Liste de contrôle par expédition internationale, **soldée** avant réservation :

1. **Pays de destination et de transit** : niveau de risque de la table `countries` (`none`, `watch`, `restricted`,
   `embargoed`) tenue par le rôle `Compliance` ; `embargoed` bloque, `restricted` exige une validation motivée.
2. **Destinataire et utilisateur final** : vérifié contre les listes de sanctions (UE, ONU, OFAC si applicable) — la
   vérification se fait dans l'outil de criblage du groupe ou à la main ; Vector enregistre qui, quand, quelle liste,
   résultat, référence de la preuve (Codex). Pas de liste importée au départ (`D-9`).
3. **Double usage** : une ligne avec un numéro de contrôle (règlement UE 2021/821, annexe I) exige une licence (n°,
   validité, autorité) ; sans licence, blocage.
4. **Marchandises dangereuses** : une ligne avec n° ONU exige la déclaration (DGD ADR, déclaration IMDG, Shipper's
   Declaration IATA) signée par une personne formée (référence Cursus du titre, lu plus tard) et l'avis de Vigie si la
   matière fait partie des matières suivies par Vigie (question D-10).
5. **Usage final** : certificat d'utilisateur final pour les pays `restricted` ou les biens sensibles.

Chaque point : `ok`, `na`, `blocked`, `waived` (dérogation motivée par `Compliance`), avec auteur et date.

## 3. Documents

Vector **ne stocke aucun fichier** : un document est une référence Codex (identifiant, révision), avec son type, son
numéro (B/L, AWB, MRN…), sa date et son état (`expected`, `received`, `checked`, `rejected`, `waived`).

### 3.1 Checklist calculée (`src/domain/documents.ts`)

La liste des documents attendus se calcule à partir du mode, du type de fret, de l'Incoterm, de l'origine et de la
destination (UE / hors UE, pays), de la procédure douanière, des marchandises dangereuses, du paiement (lettre de crédit :
plus la liste exigée par la LC) et de l'assurance. Chaque document a une **échéance** (`before_booking`, `before_pickup`,
`before_departure`, `on_arrival`, `before_closure`).

| Document | Quand il est attendu | Produit par |
| --- | --- | --- |
| Liste de colisage (packing list) | toujours | **Vector** (généré) |
| Facture proforma | international, avant la facture | **Vector** (généré, sans valeur comptable) |
| Facture commerciale | international ; LC | Sage / finance (référence) — Vector prépare les données |
| Marques de colis | toujours sauf enveloppe | **Vector** (généré) |
| Instructions d'expédition au transitaire | mer, air, multimodal | **Vector** (généré) |
| Lettre de voiture CMR | route internationale | Vector (généré) ou transporteur |
| Connaissement (B/L) | mer | transporteur (référence) |
| Lettre de transport aérien (AWB) | air | transporteur (référence) |
| Déclaration d'export (DAE / EX-A, MRN) | export hors UE | commissionnaire (référence) |
| Certificat d'origine | selon `origin_rules` ou LC | CCI (référence) — Vector prépare la demande |
| EUR.1 / EUR-MED / déclaration d'origine | accord préférentiel | douane / exportateur (référence) |
| Certificat d'assurance | CIF, CIP, LC, police spécifique | assureur (référence) |
| Déclaration de marchandises dangereuses (DGD, IMDG, IATA) | ligne avec n° ONU | déclarant formé (référence) |
| Fiche de données de sécurité | ligne avec n° ONU | Codex (référence) |
| Licence double usage | ligne avec n° de contrôle | autorité (référence) |
| Certificat d'utilisateur final | pays `restricted` | client (référence) |
| Certificat NIMP 15 / fumigation | emballage bois, selon pays | emballeur (référence) |
| VGM (masse brute vérifiée) | conteneur maritime | **Vector** (généré) |
| Preuve de livraison (POD) | toujours | transporteur / site (référence) |
| Documents de la LC (liste propre à la LC : traite, certificat d'inspection, déclaration du bénéficiaire…) | paiement `letter_of_credit` | selon la LC |

Une exception (« non requis ») se pose avec un motif. Le contrôle des **délais de la LC** : date limite d'expédition
(ATD ≤ date limite), présentation des documents sous 21 jours après l'expédition (règle des RUU 600 par défaut) et avant
la validité de la LC ; écarts signalés.

### 3.2 Documents générés et dépôt dans Codex

Vector génère en PDF (sans dépendance au départ, comme l'écrivain PDF d'Arche, ou `pdf-lib` autorisée par Norma) : liste
de colisage, facture proforma, marques de colis, instructions d'expédition, CMR, VGM. Gabarits génériques en attendant
les modèles d'EPC2i (`D-12`). Le dépôt passe par `POST /api/documents` de Codex (file d'envoi `codex_outbox`, envoyé par
une tâche ; Vector garde l'identifiant rendu) ; type documentaire proposé `SHP` (déjà ajouté par Keystone à son registre,
à créer côté Codex : demande DC-1).
