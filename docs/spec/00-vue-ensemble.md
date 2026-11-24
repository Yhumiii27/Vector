# 00 — Vue d'ensemble

> Nom de travail **Vector** (latin « celui qui transporte »), à confirmer par le propriétaire (question N-1). Le nom
> n'apparaît que dans `package.json`, `norma.config.json`, le schéma `vector`, le rôle `vector_app`, le préfixe des
> variables `VECTOR_*`, les rôles Clavis `Vector.*` et les libellés de la coque : un renommage est mécanique
> (`docs/PLAN.md` § « Renommer »).

## 1. Raison d'être

Le responsable des expéditions du groupe (expéditions nationales et internationales) n'a aujourd'hui aucun outil : les
demandes arrivent par e-mail, les colisages sont dans des tableurs, les cotations des transitaires dans la boîte de
réception, le suivi dans un tableau partagé, les documents dans des dossiers, les factures de fret chez la comptabilité
sans lien avec le projet. Keystone a reçu en octobre 2026 un écran projet « Expéditions » (R-158) pour le matériel des
projets ; il ne couvre ni les pièces de rechange, ni les retours de site, ni la mise en concurrence des transitaires, ni
la douane au-delà des données, ni les coûts, ni la performance des transporteurs, ni les expéditions hors projet.

Vector est l'outil de ce métier : **de la demande d'expédition à la preuve de livraison et au coût réel**, pour tout ce
qui part d'un site du groupe (ou d'un fournisseur pour son compte) vers un autre site, un site minier ou un client.

## 2. Périmètre

| Dans Vector | Hors Vector (et où) |
| --- | --- |
| Demandes d'expédition (projet, commande d'achat, pièce de rechange, retour de site, divers) | Projets, nomenclatures, livrables, réserves : **Keystone** |
| Expéditions, colis (caisses, palettes, conteneurs, colis lourds), contenu, SH, origine, valeur, marchandises dangereuses | Commandes d'achat et réceptions fournisseurs : **Keystone** (Livraisons) |
| Annuaire des transporteurs, transitaires, emballeurs, assureurs ; leurs performances | Fiches clients : **Keystone** (`pub_clients`) / **Modulus** |
| Appels d'offres de fret (RFQ), cotations, attribution | Documents eux-mêmes (PDF, scans) : **Codex** |
| Réservation (booking), cut-offs, calendrier des départs et arrivées | Sites et filiales : **Matrix** |
| Douane export : classement, données de déclaration, suivi EX-A / MRN, contrôle double usage et sanctions | Droits et personnes : **Clavis** |
| Checklist documentaire par mode, destination, Incoterm et paiement ; génération des documents de Vector ; dépôt dans Codex | Comptabilité, factures, paiements : **Sage** (lecture des factures fournisseurs de fret) |
| Suivi par jalons, ETA, retards ; incidents, avaries, réclamations | Incidents HSE et marchandises dangereuses côté sécurité : **Vigie** |
| Preuve de livraison (POD) ; réception par le site (avec Keystone pour le matériel de projet) | Déplacements des personnes : **Cursus** (rien dans Vector) |
| Coûts : estimés, cotés, attribués, facturés ; imputation projet / code de coût ; écarts | Stocks et entrepôt (WMS) : hors périmètre |
| Indicateurs, rapports, exports | Télédéclaration en douane : le transitaire (DELTA G / X) |

Les clients ne voient jamais Vector (comme tous les outils du groupe, décision D9-06 de Keystone) : une filiale suit ses
expéditions dans Arche par une vue `pub_`.

## 3. Personas

| Persona | Rôle Clavis proposé | Ce qu'il fait dans Vector |
| --- | --- | --- |
| **Responsable des expéditions** (le métier) | `Vector.Manager` | tout : reçoit et qualifie les demandes, prépare, lance les RFQ, attribue, réserve, suit, traite les incidents, valide les coûts, tient l'annuaire et les seuils |
| **Coordinateur logistique** (équipe expéditions, logistique projet de Keystone) | `Vector.Coordinator` | prépare et suit les expéditions qui lui sont confiées, saisit colisage, jalons, documents, incidents ; ne valide pas une attribution au-delà du seuil |
| **Demandeur** (chef de projet, acheteur, magasin de pièces de rechange, site) | `Vector.Requester` | crée une demande, suit ses expéditions, confirme la réception |
| **Magasin / emballage** (atelier, emballeur) | `Vector.Packing` | saisit les caisses, leurs dimensions, poids et contenu, les photos (références Codex) |
| **Finance** (contrôle de gestion, comptabilité fournisseurs) | `Vector.Finance` | voit les coûts et les valeurs, rapproche les factures, exporte |
| **Douane / conformité export** (si la fonction existe, sinon le responsable des expéditions) | `Vector.Compliance` | classement SH, contrôle double usage et sanctions, valide la conformité export |
| **Lecture** (direction, chef de projet sans saisie) | `Vector.Reader` | consulte, sans valeurs ni coûts sauf droit `Finance` |
| **Administrateur** | `Vector.Admin` | listes de référence, seuils, connecteurs, journal |

Les rôles sont cumulables (lus dans `clavis.pub_acces`, Norma § 6). Les valeurs marchandes et les coûts ne sont vus que
par `Manager`, `Coordinator`, `Finance`, `Compliance` et `Admin` (question U-2).

## 4. Objets

```
Demande d'expédition (SR-AAAA-NNNN)  ──► Expédition (SH-AAAA-NNNN)
  origine : projet Keystone / commande d'achat /       ├── Colis (caisses, palettes, conteneurs, colis lourds)
  pièce de rechange / retour de site / divers          │      └── Lignes de contenu (article, quantité, SH, origine, valeur, DG)
                                                       ├── Chargements (camion, conteneur 20' / 40' / HC / OT / FR, cale, pont)
                                                       ├── Étapes de transport (pré-acheminement, principal, post-acheminement)
                                                       ├── RFQ ──► Cotations (transporteur, montant, devise, délai, validité) ──► Attribution
                                                       ├── Réservation (n°, navire / vol / camion, cut-off, ETD, ETA)
                                                       ├── Jalons (prévu / réel) ──► ETA courante, retard
                                                       ├── Douane (procédure, MRN, EX-A, contrôles double usage / sanctions)
                                                       ├── Documents attendus (checklist calculée) ──► références Codex
                                                       ├── Incidents (retard, avarie, perte, douane bloquée) ──► réclamation
                                                       ├── Preuve de livraison, réception
                                                       └── Coûts (estimé, coté, attribué, facturé ; imputation)
Annuaire : transporteurs, transitaires, emballeurs, assureurs, agents en destination
Référentiels : Incoterms 2020, modes, types de chargement, types de colis, codes SH utilisés, pays (sanctions), ports et
aéroports, emballages standard, devises et cours, seuils
```

Détail : `01-demandes-expeditions.md` (demandes, expéditions, colisage, états), `02-transport.md` (annuaire, RFQ,
réservation, suivi, calendrier, carte), `03-douane-documents.md`, `04-incidents-couts-indicateurs.md`,
`05-echanges.md`, `06-droits-interface.md`, `07-donnees.md`.

## 5. Principes

- **Une seule source par objet** (Norma § 5) : l'expédition dans Vector, le projet dans Keystone, le document dans Codex,
  le site dans Matrix. Vector garde des identifiants et des références, jamais des copies qui divergent ; un miroir en
  lecture seule (connecteur) sert à l'affichage et au travail hors ligne de la source.
- **Calculé, jamais stocké** : totaux de colisage, poids taxable, taux de remplissage, documents manquants, retard, ETA
  courante, écarts de coût, indicateurs des transporteurs. Ce qui est figé l'est par un événement daté (attribution,
  départ, facture).
- **Les formats vivent dans la base** : chaque colonne a sa contrainte (états, codes, poids et dimensions positifs, SH à
  6 à 10 chiffres, pays ISO alpha-2, devise ISO 4217, UN à 4 chiffres…).
- **Journal en ajout seul** : chaque écriture est journalisée dans la même transaction (déclencheur qui refuse
  `UPDATE` / `DELETE` sur `audit_entries`) ; aucune suppression physique d'un objet tracé (annulation motivée).
- **Une seule horloge** (`VECTOR_CLOCK` pour les démonstrations, sinon la date réelle).
- **Rien ne sort du serveur** sans la DSI : connecteurs de transporteurs et de visibilité simulés tant qu'ils ne sont pas
  validés.
