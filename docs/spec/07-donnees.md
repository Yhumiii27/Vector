# 07 — Modèle de données (schéma `vector`)

Toutes les tables dans le schéma `vector` (`vector.table(…)`, objet `pgSchema` jamais exporté), écrites par `vector_app`.
Chaque colonne a sa contrainte (Norma § 4). Les identifiants internes sont des `uuid` ; les références métier sont uniques.

| Table | Clés et contraintes principales |
| --- | --- |
| `audit_entries` | journal en ajout seul (déclencheur qui refuse `UPDATE` / `DELETE`) |
| `app_settings` | seuils réglables (clé, valeur JSON validée par l'application) |
| `counters` | compteurs annuels des références (`SR`, `SH`, `RFQ`, `INC`) |
| `sites` | miroir de `matrix.pub_sites` + sites de démonstration : code `^[a-z0-9_-]{2,32}$`, nom non vide, pays ISO alpha-2, latitude / longitude bornées |
| `partners` | type (domaine), nom non vide, pays, modes (tableau non vide de valeurs du domaine), état, motif de suspension si suspendu |
| `incoterms` | 11 codes Incoterms 2020 (`^[A-Z]{3}$`), modes `any` / `sea`, répartition vendeur / acheteur |
| `countries` | ISO alpha-2, nom, UE (booléen), niveau de risque (domaine) |
| `hs_codes` | code `^[0-9]{6,10}$`, désignation, numéro de contrôle double usage facultatif |
| `exchange_rates` | devise ISO 4217 `^[A-Z]{3}$`, date, taux > 0, unique (devise, date) |
| `cost_standards` | mode, zone, € / kg > 0 |
| `shipment_requests` | `ref ^SR-[0-9]{4}-[0-9]{4}$`, origine (domaine), projet ou code de coût (au moins un), dates `ready_on ≤ needed_on`, urgence, état, motif si rejetée / annulée, `shipment_id` |
| `shipments` | `ref ^SH-[0-9]{4}-[0-9]{4}$`, mode, type de fret, Incoterm (FK), départ / arrivée (site ou adresse + pays), paiement, LC (n°, dates : `lc_latest_shipment ≤ lc_expiry`), assurance, dates (ATD ≥ ETD n'est pas exigé ; `ata ≥ atd`), état, motif, `previous_state` pour `on_hold` |
| `packages` | (expédition, n°) unique, type, dimensions > 0, `0 < net ≤ gross`, gerbable |
| `package_lines` | quantité > 0, SH, origine, valeur ≥ 0, devise, UN `^UN[0-9]{4}$`, classe, groupe `I`/`II`/`III` (UN ⇒ classe) |
| `loads` | type de chargement (domaine), identifiant (conteneur `^[A-Z]{4}[0-9]{7}$` pour un conteneur), plomb |
| `rfqs`, `quotes` | RFQ : état ; cotation : montant ≥ 0, devise, délai > 0, validité, état (`received`, `awarded`, `declined`, `expired`), motif d'attribution |
| `bookings` | n° non vide, partenaire, navire / vol, cut-offs, ETD / ETA |
| `milestones` | (expédition, code) unique, prévu / réel, lieu |
| `customs_declarations` | procédure, MRN (forme), date de sortie |
| `compliance_checks` | (expédition, contrôle) unique, état, motif si dérogation |
| `shipment_documents` | type, état, n°, référence Codex, motif si `waived` |
| `incidents` | `ref ^INC-…`, type, gravité, montants ≥ 0, état |
| `cost_lines` | catégorie, partenaire, estimé / coté / facturé ≥ 0, devise, imputation (projet ou code de coût) |
| `codex_outbox`, `vigie_outbox`, `tracking_events` | files d'envoi et événements simulés |
