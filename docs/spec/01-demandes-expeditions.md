# 01 — Demandes, expéditions, colisage

## 1. Demande d'expédition

Une demande dit **quoi** doit aller **où**, **pour quand**, **pour quoi** (imputation) ; elle n'engage aucun transporteur.

| Champ | Règle |
| --- | --- |
| Référence | `SR-AAAA-NNNN`, compteur annuel, donnée par la base dans la transaction |
| Origine | `project` (projet Keystone, code `pub_projets`), `purchase_order` (commande d'achat : enlèvement chez le fournisseur), `spare_part` (pièce de rechange, souvent urgente), `site_return` (retour de site vers l'atelier), `other` |
| Projet / code de coût | code projet Keystone (contrôlé contre `keystone.pub_projets` quand la source est lisible) et / ou code de coût libre `^[A-Z0-9-]{2,20}$` ; l'un des deux est obligatoire |
| Départ, arrivée | site du groupe (code Matrix `pub_sites`) **ou** adresse libre (fournisseur, site minier, client), avec pays ISO alpha-2 obligatoire |
| Date de mise à disposition, date de besoin | `ready_on ≤ needed_on` |
| Urgence | `normal`, `urgent`, `critical` (arrêt de production chez le client : aérien proposé) |
| Contenu annoncé | description, poids et volume estimés, présence de marchandises dangereuses (oui / non / ne sait pas), valeur estimée |
| Incoterm demandé | Incoterm 2020 et lieu ; par défaut celui du contrat du projet (Keystone) |
| État | `draft` → `submitted` → `accepted` (une expédition est créée ou la demande est rattachée à une expédition existante : groupage) · `rejected` (motif) · `cancelled` (motif) |

Plusieurs demandes peuvent être **groupées** dans une expédition (même départ, même destination, dates compatibles) ; une
demande peut être **éclatée** en plusieurs expéditions (une partie urgente par avion, le reste par mer).

## 2. Expédition

| Champ | Règle |
| --- | --- |
| Référence | `SH-AAAA-NNNN` |
| Mode principal | `road`, `sea`, `air`, `rail`, `express` (intégrateur colis), `multimodal` |
| Type de fret | `parcel`, `ltl` (groupage routier), `ftl` (camion complet), `fcl` (conteneur complet), `lcl` (groupage maritime), `breakbulk`, `roro`, `air_general`, `air_charter` |
| Incoterm, lieu | Incoterm 2020 ; un Incoterm maritime (FAS, FOB, CFR, CIF) hors mode maritime est **signalé** (pas refusé, comme Keystone) |
| Départ / arrivée | site ou adresse ; ports / aéroports de chargement et de déchargement (codes UN/LOCODE ou IATA) |
| Responsable | coordinateur ; le responsable des expéditions par défaut |
| Paiement | `open_account`, `letter_of_credit` (n° de LC, banque, date limite d'expédition, date de validité, documents exigés), `cash_against_documents`, `prepaid` |
| Assurance | `none`, `buyer`, `policy` (police annuelle du groupe), `specific` (police ad hoc) ; valeur assurée = valeur CIF × 110 % par défaut (CIP / CIF) |
| Dates | prête le, ETD / ETA prévues, ATD / ATA réelles, livrée le |
| État | voir § 4 |

## 3. Colisage

### 3.1 Colis

| Champ | Règle |
| --- | --- |
| N° | 1, 2… par expédition ; marque « SH-2026-0012 / 3 de 7 » calculée |
| Type | `crate` (caisse bois), `box`, `pallet`, `skid`, `drum`, `bundle`, `unit` (machine non emballée), `container` (conteneur appartenant à l'expéditeur, SOC), `envelope` |
| Dimensions | longueur, largeur, hauteur en cm, entiers > 0 ; volume calculé (m³, 3 décimales) |
| Poids | brut et net en kg, `net ≤ brut`, > 0 |
| Gerbable, basculable | booléens ; « ne pas gerber » et « haut » imprimés sur les marques |
| Hors gabarit | calculé : une dimension dépasse le gabarit du chargement prévu (conteneur 20' : 589 × 235 × 239 cm ; 40' : 1203 × 235 × 239 ; 40' HC : 1203 × 235 × 269 ; plateau routier standard 1360 × 248 × 270 et 24 t), ou poids > seuil `heavy_lift_kg` (10 t par défaut) |
| Emballage | norme d'emballage (HPE, ISPM 15 traité NIMP 15 obligatoire pour le bois à l'export, marquage) |
| Photos | références Codex |

### 3.2 Contenu

Une ligne : article (référence Keystone `pub_articles` si lisible, sinon description libre), quantité, unité, code SH
(6 à 10 chiffres, nomenclature combinée à 8 chiffres pour l'UE), pays d'origine (ISO alpha-2), valeur unitaire et devise,
poids net, numéro de commande, restriction export (double usage : numéro de contrôle UE annexe I, ex. `1C011`), et pour
une marchandise dangereuse : n° ONU (`UN` + 4 chiffres), classe, groupe d'emballage (I, II, III), quantité nette.

### 3.3 Totaux et calculs (règles pures, `src/domain/packing.ts`)

- nombre de colis, poids brut et net, volume, valeur par devise, par code SH (synthèse douane : valeur, poids net, origine) ;
- **poids taxable** selon le mode (`src/domain/chargeable.ts`) :
  - aérien : max(poids brut, volume en cm³ / 6000) — facteur IATA 1:6000 (167 kg / m³) ;
  - express : facteur 1:5000 (200 kg / m³) par défaut, réglable par transporteur ;
  - maritime groupage (LCL) : unité payante = max(poids en t, volume en m³) (« 1 t = 1 m³ ») ;
  - routier : max(poids, volume × 333 kg / m³) (1:3), ou mètres de plancher pour le complet (1 m de plancher ≈ 1,75 t) ;
  - FCL et affrètement : au conteneur ou au forfait, le poids taxable n'est qu'indicatif ;
- **taux de remplissage** d'un chargement : volume des colis / volume utile, poids / charge utile ; dépassement refusé à
  la validation du colisage (poids) ou signalé (volume, empotage réel à confirmer) ;
- contrôle du colisage contre la nomenclature Keystone pour une expédition de projet (manquants, excédents, hors
  nomenclature), repris de R-158 : il reste dans Keystone tant que Keystone tient la nomenclature, Vector le lit (question
  T-3).

## 4. États de l'expédition (`src/domain/shipment-state.ts`)

```
draft ──► planned ──► booked ──► picked_up ──► in_transit ──► arrived ──► delivered ──► closed
  │          │           │                                                              ▲
  └──────────┴───────────┴──► cancelled (motif)                         on_hold (motif) ┘ (depuis planned … arrived, retour à l'état d'avant)
```

| Transition | Condition (bloquante) |
| --- | --- |
| draft → planned | départ, arrivée, mode, Incoterm, au moins un colis avec dimensions et poids |
| planned → booked | une cotation attribuée **et** une réservation (n°, transporteur) ; contrôle export « soldé » pour l'international ; colisage validé |
| booked → picked_up | date réelle d'enlèvement ; documents « avant départ » de la checklist présents (ou exception motivée) |
| picked_up → in_transit | départ réel du transport principal (ATD) ; pour l'export UE : MRN reçu |
| in_transit → arrived | arrivée réelle (ATA) au port / aéroport / dépôt de destination |
| arrived → delivered | preuve de livraison (date, signataire, référence Codex), réserves notées |
| delivered → closed | aucun incident ouvert ; coûts facturés rapprochés **ou** clôture forcée par le responsable avec motif |
| * → cancelled | motif ; impossible après `picked_up` (un retour se fait par une nouvelle expédition) |
| * → on_hold | motif (douane bloquée, paiement LC, attente client) ; la reprise revient à l'état d'avant |

Chaque transition est journalisée (auteur, date, motif). Le statut de Keystone R-158 (`draft`, `prepared`, `picked_up`,
`in_transit`, `arrived`, `received`, `closed`) se déduit de celui de Vector pour la vue `pub_expeditions` (contrat repris,
§ 05).
