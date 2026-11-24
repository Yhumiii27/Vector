# Vector — demandes aux autres outils (brouillons)

Aucune n'est envoyée : chacune attend une note au propriétaire et son « validé » (Norma § 3), puis une entrée dans le
`REQUESTS.md` de l'outil visé (ou un lien dans le registre de Matrix).

| Id | Outil | Demande | Pourquoi | Sans elle |
| --- | --- | --- | --- | --- |
| DN-1 | Norma | **faite** (Norma 2.1.0, 24 nov. 2026) — inscrire `vector` au registre (`registre/outils.json` : dépôt, schéma `vector`, rôle `vector_app`, ports 3900 / 3910, `ENTRA_ISSUER`, `VECTOR_ACCESS_FROM_CLAVIS=on`, commits en anglais) et ajouter `reste-a-faire/vector.json` | `npm run norma:check` refuse un outil absent du registre ; liste unique du reste à faire | le contrôle Norma de la CI échoue |
| DM-1 | Matrix | créer le schéma `vector` et le rôle `vector_app` sur le serveur commun (comme pour Modulus) | Vector écrit seulement dans son schéma | pas de mise en service |
| DM-2 | Matrix | liens de lecture : `vector_app` → `clavis.pub_acces`, `clavis.pub_personnes`, `matrix.pub_sites`, `matrix.pub_filiales`, `keystone.pub_projets`, `keystone.pub_articles`, `keystone.pub_nomenclatures`, `keystone.pub_fournisseurs`, `keystone.pub_clients`, `keystone.pub_jalons_projets`, `codex.pub_documents` | lectures du § 2 de `docs/spec/05-echanges.md` | connecteurs en « source indisponible » |
| DM-3 | Matrix | publier `vector.pub_expeditions` (contrat R-158 v1 repris), `vector.pub_colis`, `vector.pub_demandes`, `vector.pub_couts_expeditions` d'après les requêtes de référence de `src/server/publications/definitions.ts` | transition depuis Keystone | Arche et Keystone ne voient pas Vector |
| DC-1 | Codex | créer le type documentaire `SHP` (expédition) et autoriser `vector` sur `POST /api/documents` (clé d'API) | documents générés et pièces | dépôts « en attente » dans la file |
| DK-1 | Keystone | valider la transition (`docs/spec/05-echanges.md` § 4), publier `keystone.pub_expeditions_contenu` (import unique) et `keystone.pub_receptions_expeditions` (état de réception et réserves), lire `vector.pub_colis` pour le contrôle colisage | une seule source par expédition | deux outils pour le même envoi |
| DK-2 | Keystone | publication `keystone.pub_commandes_achat` (commandes d'achat, fournisseur, Incoterm d'achat) | enlèvements fournisseurs (D-2) | saisie à la main du n° de commande |
| DA-1 | Arche | après DM-3, basculer la lecture de `keystone.pub_expeditions` vers `vector.pub_expeditions` | transition | Arche lit une vue qui se vide |
| DV-1 | Vigie | API ou fonction `vigie.pub_signaler_incident_transport` pour un incident de transport (marchandises dangereuses, sécurité) | D-10 | signalement à la main dans Vigie |
| DCL-1 | Clavis | ajouter l'application `vector` et ses rôles `Vector.Manager`, `Vector.Coordinator`, `Vector.Requester`, `Vector.Packing`, `Vector.Finance`, `Vector.Compliance`, `Vector.Reader`, `Vector.Admin` au catalogue (`ROLE_CATALOGUE`), et inscrire le client OpenID Connect (`npm run oidc:client -- vector <url>/auth/callback`) | connexion et droits | pas de connexion hors démonstration |
