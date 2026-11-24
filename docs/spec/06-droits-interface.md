# 06 — Droits et interface

## 1. Connexion et droits

- Connexion par **Clavis** (OpenID Connect de forme Entra ID, `ENTRA_ISSUER` = adresse de Clavis), inscription par
  `npm run oidc:client -- vector <url>/auth/callback` dans Clavis.
- Avec `VECTOR_ACCESS_FROM_CLAVIS=on`, les rôles se lisent dans `clavis.pub_acces` (`application = 'vector'`, `ouvert`,
  `role` = `Vector.Manager`…) à la connexion et à chaque requête ; **lecture impossible = refus** ; les rôles du jeton ne
  sont jamais utilisés.
- Mode démonstration (`VECTOR_AUTH=demo`, défaut en développement) : sélecteur « Voir en tant que » (cookie
  `vector-role`), jamais exposé sans authentification HTTP.

| Droit (`src/domain/rights.ts`) | Manager | Coordinator | Requester | Packing | Finance | Compliance | Reader | Admin |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Voir les expéditions | toutes | toutes | les siennes (demandées) | toutes (sans valeur) | toutes | toutes | toutes | toutes |
| Créer une demande | ● | ● | ● | | | | | ● |
| Accepter / rejeter une demande | ● | ● | | | | | | |
| Préparer, colisage | ● | ● | | ● | | | | |
| RFQ, cotations | ● | ● | | | | | | |
| Attribuer au-delà du seuil | ● | | | | | | | |
| Réservation, jalons, documents | ● | ● | | | | | | |
| Conformité export | ● (sauf dérogation) | | | | | ● | | |
| Incidents | ● | ● | déclarer | déclarer | | | | |
| Coûts : voir / rapprocher | ● / ● | ● / | | | ● / ● | ● / | | ● / |
| Valeurs marchandes | ● | ● | | | ● | ● | | ● |
| Annuaire | ● | lire | | | lire | lire | lire | ● |
| Référentiels, seuils | ● | | | | | ● (pays, SH) | | ● |

Toute Server Function revérifie les droits et valide ses entrées côté serveur ; une expédition hors du périmètre du
demandeur est un 404.

## 2. Interface (charte Nocturne, Norma § 7)

Coque reprise d'Arche / Clavis : barre latérale par thème avec compteurs, recherche de pages ⌘K, en-tête de page (titre,
actions, sélecteur FR / EN puis bouton sombre / clair), actions principales dans l'en-tête et menu « Actions » au-delà de
trois, formulaires seulement dans des panneaux latéraux fermés au succès, état d'écran dans l'URL.

| Groupe | Écran | Route |
| --- | --- | --- |
| Pilotage | Accueil (tableau de bord : en cours, retards, cut-offs proches, documents en retard, coûts du mois) | `/` |
| Pilotage | Calendrier des départs et arrivées | `/calendar` |
| Pilotage | Carte des flux | `/map` |
| Expéditions | Demandes | `/requests` |
| Expéditions | Expéditions (liste filtrable) | `/shipments` |
| Expéditions | Fiche d'expédition : onglets Résumé, Colisage, Transport (RFQ, cotations, réservation), Suivi (jalons), Douane & documents, Incidents, Coûts, Journal | `/shipments/[ref]?tab=` |
| Expéditions | Appels d'offres (comparaison) | `/rfq` |
| Expéditions | Incidents | `/incidents` |
| Partenaires | Annuaire et performance | `/partners`, `/partners/[id]` |
| Douane | Codes SH, pays, conformité | `/customs` |
| Analyse | Rapports et exports CSV | `/reports` |
| Administration | Référentiels et seuils | `/admin` |
| Administration | Journal | `/journal` |
| Administration | Connecteurs | `/admin/connectors` |
