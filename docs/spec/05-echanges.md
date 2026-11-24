# 05 — Échanges avec les autres outils

Règles : `norma/REGLES.md` § 5 (lecture par vues `pub_` définies par Matrix ; écriture par API ou fonction `pub_` ;
accès déclarés comme liens du registre de Matrix). Aucune migration de Vector ne crée de vue `pub_` : Vector fournit des
**requêtes de référence** (`src/server/publications/definitions.ts`, testées) que Matrix publie.

## 1. Ce que Vector publie (requêtes de référence ; Matrix définit les vues)

| Vue | Lecteurs | Contenu | Jamais |
| --- | --- | --- | --- |
| `vector.pub_expeditions` | `keystone_app`, `arche_app` | **contrat R-158 v1 de `keystone.pub_expeditions` repris colonne pour colonne** (`projet_code`, `expedition_ref`, `equipements`, `statut` dans le vocabulaire de Keystone, `mode`, `incoterm`, `incoterm_lieu`, `origine`, `destination`, `etd`, `eta`, `depart_reel_le`, `arrivee_reelle_le`, `receptionnee_le`, `nb_chargements`, `nb_reserves_ouvertes`, `maj_le`), puis en fin : `statut_vector`, `eta_courante`, `retard_jours`, `nb_colis`, `poids_brut_kg`, `lien` | valeur, prix, coût, contact du transitaire |
| `vector.pub_colis` | `keystone_app` | une ligne par colis : expédition, n°, type, dimensions, poids, contenu (article, quantité) — pour le pointage de réception dans Keystone | valeur |
| `vector.pub_couts_expeditions` | `keystone_app` (droit Finance de Keystone), `matrix_app` | coûts par expédition, catégorie et imputation (projet, poste), coté et facturé en € | — |
| `vector.pub_demandes` | `keystone_app` | demandes d'expédition et leur état, pour l'écran projet de Keystone | valeur |

## 2. Ce que Vector lit

| Objet | Pourquoi | État |
| --- | --- | --- |
| `clavis.pub_acces` (et `clavis.pub_personnes`) | rôles `Vector.*` à la connexion et à chaque requête | existe ; lien à déclarer |
| `matrix.pub_sites`, `matrix.pub_filiales` | sites de départ et d'arrivée, filiales | existe ; lien à déclarer |
| `keystone.pub_projets` | projet d'une demande, imputation | existe |
| `keystone.pub_articles` | désignation, code SH, restriction export des articles | existe |
| `keystone.pub_nomenclatures` | contrôle colisage ↔ nomenclature d'une expédition de projet | existe |
| `keystone.pub_fournisseurs` | adresse d'enlèvement d'une commande d'achat | existe |
| `keystone.pub_clients` | destinataire d'une expédition client | existe |
| `keystone.pub_jalons_projets` | date de besoin sur site (jalon `arrivee_site`) | existe |
| `keystone.pub_receptions_expeditions` | état de réception sur site et réserves | **à demander** à Keystone / Matrix |
| `keystone.pub_commandes_achat` | commandes d'achat (enlèvement fournisseur) | **à demander** (n'existe pas) |
| `codex.pub_documents` | état et révision des documents cités | existe |
| `vigie.pub_ordres_modification` | rien au départ | — |
| Sage (factures fournisseurs de fret) | rapprochement des coûts | fichier d'extraction comme Arche (AR-047, `ARCHE_SAGE_DIR`) : `VECTOR_SAGE_DIR` |

## 3. Écritures

- **Vector → Codex** : dépôt des documents générés et des pièces (`POST /api/documents`, file `codex_outbox`).
- **Vector → Vigie** : signalement d'un incident de sécurité ou de marchandise dangereuse par l'API de Vigie (à demander)
  ou une fonction `vigie.pub_signaler_incident_transport` (à demander) ; file `vigie_outbox` en attendant.
- **Keystone → Vector** : création d'une demande d'expédition depuis l'écran projet (`POST /api/v1/shipment-requests`,
  clé d'API, écriture signée, comme l'API d'Arche) ; Keystone garde la référence `SR-…`.
- **Matrix → Vector** : `vector.pub_editer` (M-19) pour les corrections de la DSI sur les référentiels (partenaires,
  pays, codes SH) — livraison L6.

## 4. Transition depuis Keystone (R-158)

Keystone tient depuis le 25 octobre 2026 un écran projet « Expéditions » (expéditions EXP-01…, chargements, contenu,
contrôle du colisage contre la nomenclature, étapes d'après l'Incoterm du contrat, documents générés et versés dans Codex,
réception sur site avec réserves, vue `keystone.pub_expeditions` lue par Arche). Proposition (question T-1), sur le
modèle de la transition du catalogue vers Modulus :

| Étape | Qui | Quoi |
| --- | --- | --- |
| 0 | Vector | livraisons L1 à L4 ; import **unique et journalisé** des expéditions de Keystone en cours (lecture de `keystone.pub_expeditions`, et des chargements / contenu par une vue à demander, `keystone.pub_expeditions_contenu`), avec la référence d'origine (`EXP-01` du projet) gardée en alias |
| 1 | Matrix | publie `vector.pub_expeditions` (mêmes colonnes que R-158 v1, colonnes nouvelles en fin) et `vector.pub_colis` |
| 2 | Arche | bascule sa lecture de `keystone.pub_expeditions` vers `vector.pub_expeditions` (PR dans Arche, colonnes identiques) |
| 3 | Keystone | l'écran Expéditions devient une **lecture** de Vector (liste, état, ETA, lien profond `VECTOR_URL/shipments/SH-…`) ; le bouton « Nouvelle expédition » devient « Demander une expédition » (API de Vector) ; restent dans Keystone : l'Incoterm du contrat, la nomenclature et le **contrôle colisage ↔ nomenclature** (Keystone lit `vector.pub_colis`), le livrable « Colisage & documents douaniers », la **réception sur site et les réserves** (punch list), le jalon `arrivee_site` de `pub_jalons_projets` (calculé depuis `vector.pub_expeditions`) |
| 4 | Matrix | retire `keystone.pub_expeditions` quand plus aucun lecteur n'en dépend |
| — | tous | pendant la transition, **une seule source par expédition** : Keystone jusqu'à l'import, Vector ensuite ; les expéditions closes restent dans Keystone (historique), non importées |

Statuts : `draft`/`planned` → `draft` ; `booked` → `prepared` ; `picked_up` → `picked_up` ; `in_transit` → `in_transit` ;
`arrived` → `arrived` ; `delivered` → `received` si Keystone a pointé la réception, sinon `arrived` ; `closed` → `closed` ;
`cancelled` et `on_hold` → état d'avant (et `statut_vector` en fin de vue).

Demandes correspondantes : `docs/DEMANDES.md`.

## 5. Ce que Vector ne fait pas avec Cursus

Les déplacements des personnes (missions, billets, visas, frais) sont dans Cursus. Vector n'en lit ni n'en écrit rien.
Seul lien possible plus tard : le titre « déclarant marchandises dangereuses » d'une personne (`cursus.pub_titres_detenus`)
pour la signature d'une DGD (question D-10).
