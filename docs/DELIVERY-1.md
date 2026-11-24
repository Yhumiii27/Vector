# Livraison 1 — socle et interface complète (24 novembre 2026)

Construite sur les réponses par défaut de `docs/DECISIONS.md` (aucune réponse du propriétaire à cette date), sur un jeu de
démonstration **entièrement fictif**. Branche `claude/quirky-brown-c7af5m` du dépôt `Yhumiii27/vector`.

## 1. Ce qui est construit

| Domaine | Où | Contenu |
| --- | --- | --- |
| Socle | `docs/SOCLE.md` | repris de Clavis `main` ; connexion par Clavis (OpenID Connect) et droits lus dans `clavis.pub_acces` (`VECTOR_ACCESS_FROM_CLAVIS=on`), mode démonstration « Voir en tant que » (8 profils) ; journal en ajout seul ; configuration validée au démarrage ; i18n (anglais source, français par défaut) ; thème `epc2i-theme` ; CI |
| Schéma | `src/server/db/schema/`, `drizzle/0000`, `0001` | 26 tables du schéma `vector`, **138 contraintes CHECK** (états, formats SR- / SH- / RFQ- / INC-, pays ISO, devise ISO 4217, SH 6–10 chiffres, ONU, MRN, conteneur ISO 6346, poids et dimensions positifs, cohérences : net ≤ brut, ETD ≤ ETA, motif obligatoire d'une annulation, preuve de livraison d'une expédition livrée…) |
| Règles pures | `src/domain/` (tests `shipping.test.ts`, `auth.test.ts`, `geo.test.ts`, `csv.test.ts`) | états de l'expédition (`shipment-state.ts`), colisage, poids taxable aérien 1:6000 / express 1:5000 / route 1:3 / mer W/M, gabarits et taux de remplissage, colis lourd, synthèse SH, répartition au prorata (`packing.ts`), Incoterms 2020 (`incoterms.ts`), liste des documents par mode / destination / Incoterm / marchandises / paiement, retards, délais des crédits documentaires (`documents.ts`), ETA courante et retards (`eta.ts`), coûts, cours, écarts (`costs.ts`), classement des cotations et règles d'attribution (`quotes.ts`), conformité export (`compliance.ts`), délais de réclamation CMR / Montréal / La Haye-Visby (`claims.ts`), indicateurs et note des transporteurs (`kpi.ts`), carte (`geo.ts`) |
| Écritures | `src/features/shipping/actions.ts` (test `actions.test.ts`) | 28 Server Functions : demande (créer, transmettre, accepter dans une nouvelle expédition ou par groupage, refuser, annuler), expédition (modifier, transitions avec dates réelles, suspendre / reprendre / annuler), colisage (colis, lignes, chargements, validation), appels d'offres, cotations, attribution (seuil et motif), réservation, jalons, douane, conformité (dérogation par la conformité seule, jamais un embargo), documents (référence Codex, génération mise en file pour Codex), incidents et réclamations, coûts et rapprochement (seuil d'écart), partenaires, cours, pays, codes SH, seuils |
| Écrans | `src/app/(app)/` | Accueil, Demandes, Expéditions, fiche d'expédition (Résumé, Colisage, Transport, Suivi, Douane et documents, Incidents, Coûts, Journal), Appels d'offres, Incidents, Transporteurs et transitaires (+ fiche), Douane et conformité, Départs et arrivées (calendrier), Carte des flux (SVG sans tuile), Rapports et exports CSV, Référentiels et seuils, Connecteurs, Journal ; documents imprimables `/print/shipments/<réf>/<document>` |
| Publications | `src/server/publications/definitions.ts` (testées) | requêtes de référence de `vector.pub_expeditions` (contrat R-158 v1 de Keystone repris colonne pour colonne, puis colonnes de Vector), `pub_colis`, `pub_demandes`, `pub_couts_expeditions` — à publier par Matrix (DM-3) |

## 2. Ce qui est simulé

| Connecteur | Comportement | Passe en vrai quand |
| --- | --- | --- |
| Codex (`POST /api/documents`) | file `outbox`, la tâche `outbox` rend une référence `SHP-SIM-…` | DC-1 (type `SHP`, clé d'API) |
| Vigie (incidents de sécurité, marchandises dangereuses) | file `outbox`, marquée envoyée | DV-1 |
| Messagerie (appels d'offres) | file `outbox` | choix du transport par la DSI (D-15) |
| Suivi des transports | tâche `tracking` : remonte les jalons prévus échus (transbordement, entrée au terminal, chargement) | D-14 et accord DSI |
| Keystone, Matrix, Codex en lecture | `keystone.pub_projets` lu s'il est accordé, sinon « source indisponible » ; sites et pays du jeu de démonstration | liens DM-2 |
| Sage | coûts saisis | D-19 |

## 3. Vérifications

`npx next typegen && npm run typecheck && npm run lint && npm test` (28 fichiers, 148 tests, PostgreSQL), `npm run build`, test de
fumée `npm run test:smoke` (38 contrôles : chaque écran, chaque onglet, impression, exports, droits du lecteur et du demandeur)
sur `next start --port 3910` et la base `vector_dev`.

**`npm run norma:check` échoue** tant que Norma n'a pas inscrit `vector` à son registre (demande DN-1) : la copie est intacte,
seul l'outil est inconnu du registre. Le contrôle n'est pas contourné.

## 4. Limites connues

- Pas de suppression ni de modification d'un colis ou d'une ligne (ajout seulement) ; pas d'édition d'une demande après sa
  transmission ; pas de répartition manuelle des coûts (règle D-7 calculée, colonne prévue).
- PDF : les documents sont des pages imprimables (le navigateur les enregistre en PDF) ; génération serveur à la livraison 4.
- Pas encore de test de bout en bout dans un navigateur (Playwright) ni de contrôle d'accessibilité automatisé.
