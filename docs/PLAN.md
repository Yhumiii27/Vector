# Vector — plan des livraisons

| Livraison | Contenu | Attend |
| --- | --- | --- |
| **L0 — cadrage** | benchmark, spec 00–07, décisions et questionnaire, plan, données à fournir, demandes aux autres outils | — (fait le 24 nov. 2026) |
| **L1 — socle et interface** | socle repris de Clavis (connexion par Clavis / démonstration, droits lus dans `clavis.pub_acces`, journal en ajout seul, configuration validée, i18n, thèmes, CI) ; schéma complet avec contraintes ; règles pures testées (états, colisage, poids taxable, Incoterms, checklist documentaire, ETA et retards, écarts de coût, indicateurs, conformité) ; **tous les écrans** sur un jeu de démonstration fictif ; connecteurs simulés (Codex, Vigie, suivi, Keystone, Matrix) ; exports CSV | N-1, U-1, U-2 (défauts appliqués) |
| **L2 — demandes et colisage en vrai** | lecture réelle de `keystone.pub_projets`, `pub_articles`, `matrix.pub_sites` (liens Matrix) ; import des données DA-2, DA-4, DA-5 ; API `POST /api/v1/shipment-requests` pour Keystone | T-1, T-3, D-1 à D-4, liens Matrix |
| **L3 — transport** | RFQ par e-mail (transport choisi avec la DSI), cours de change, annuaire réel (DA-1) | D-5, D-6, D-8, D-15 |
| **L4 — douane et documents** | génération PDF des documents (gabarits de l'entreprise), dépôt réel dans Codex, table des pays et codes SH validés, lettres de crédit | D-9, D-10, D-12, D-18, DA-3, DA-6, DA-8, demande Codex DC-1 |
| **L5 — coûts, incidents, performance** | imputation, rapprochement, réclamations, note des transporteurs, CO₂ si demandé, lecture de la réception Keystone | D-7, D-11, D-13, D-17, T-4, DA-7 |
| **L6 — intégrations** | Sage (factures de fret), suivi automatique si validé, `vector.pub_editer` (M-19), transition Keystone étapes 1 à 4 | D-14, D-16, D-19, Matrix |
| **Pilote** | un site de départ, le responsable des expéditions et deux coordinateurs, 4 semaines, retours notés | hébergement, Clavis, Matrix |

## Renommer l'outil (question N-1)

Tant que rien n'est en service : remplacer `vector` / `Vector` / `VECTOR_` dans `package.json`, `norma.config.json`,
`src/server/db/schema/_schema.ts` (schéma), `.env.example`, `src/server/config/parse.ts`, `src/domain/auth.ts` (rôles
`Vector.*`), `src/i18n`, `docs/` ; régénérer les migrations (aucune n'est publiée). Après mise en service : nouveau schéma
par Matrix et reprise des données, à éviter.
