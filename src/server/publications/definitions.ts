// Vector's publications (docs/spec/05 § 1). Matrix defines and applies the `pub_` views (decision M-18): these are the reference
// queries given to Matrix (request DM-3), executed as they are by ./definitions.test.ts. A column is never removed or renamed;
// a new one goes at the end; an incompatible change is a `_v2`.

/** Status of the shared contract R-158 v1 (keystone.pub_expeditions), from Vector's state (src/domain/shipment-state.ts). */
const KEYSTONE_STATUS = `CASE coalesce(CASE WHEN s.state IN ('on_hold', 'cancelled') THEN s.previous_state END, CASE WHEN s.state IN ('on_hold', 'cancelled') THEN 'draft' ELSE s.state END)
         WHEN 'planned' THEN 'draft' WHEN 'draft' THEN 'draft' WHEN 'booked' THEN 'prepared' WHEN 'delivered' THEN 'arrived'
         ELSE coalesce(CASE WHEN s.state IN ('on_hold', 'cancelled') THEN s.previous_state END, s.state) END`;

/**
 * vector.pub_expeditions — contract R-158 v1 of keystone.pub_expeditions kept column for column (Arche reads it the same way),
 * then Vector's own columns at the end. No value, no price, no cost, no partner contact.
 */
export const PUB_EXPEDITIONS = `SELECT (SELECT min(r.project_code) FROM vector.shipment_allocations a JOIN vector.shipment_requests r ON r.id = a.request_id
          WHERE a.shipment_id = s.id)                       AS projet_code,
       coalesce(s.keystone_ref, s.ref)                     AS expedition_ref,
       s.title                                             AS equipements,
       ${KEYSTONE_STATUS}                                  AS statut,
       CASE WHEN s.mode IN ('road', 'sea', 'air', 'multimodal') THEN s.mode WHEN s.mode = 'express' THEN 'air' ELSE 'multimodal' END AS mode,
       s.incoterm                                          AS incoterm,
       s.incoterm_place                                    AS incoterm_lieu,
       coalesce(fs.name, s.from_address)                   AS origine,
       coalesce(ts.name, s.to_address)                     AS destination,
       s.etd,
       s.eta,
       s.atd                                               AS depart_reel_le,
       s.ata                                               AS arrivee_reelle_le,
       s.delivered_on                                      AS receptionnee_le,
       (SELECT count(*)::int FROM vector.loads l WHERE l.shipment_id = s.id) AS nb_chargements,
       (SELECT count(*)::int FROM vector.incidents i WHERE i.shipment_id = s.id AND i.state IN ('open', 'claimed')) AS nb_reserves_ouvertes,
       s.updated_at                                        AS maj_le,
       s.ref                                               AS vector_ref,
       s.state                                             AS statut_vector,
       coalesce(s.latest_eta, b.eta, s.eta)                AS eta_courante,
       (SELECT count(*)::int FROM vector.packages p WHERE p.shipment_id = s.id) AS nb_colis,
       (SELECT coalesce(sum(p.gross_kg), 0) FROM vector.packages p WHERE p.shipment_id = s.id) AS poids_brut_kg
FROM vector.shipments s
LEFT JOIN vector.sites fs ON fs.code = s.from_site
LEFT JOIN vector.sites ts ON ts.code = s.to_site
LEFT JOIN vector.bookings b ON b.shipment_id = s.id`;

/** vector.pub_colis — one row per package and content line (Keystone's packing check and site reception); no value. */
export const PUB_COLIS = `SELECT s.ref AS expedition_ref, p.number AS colis_no, p.type AS type_colis, p.length_cm AS longueur_cm, p.width_cm AS largeur_cm,
       p.height_cm AS hauteur_cm, p.gross_kg AS poids_brut_kg, p.net_kg AS poids_net_kg, l.part_ref AS article_ref, l.description AS designation,
       l.quantity AS quantite, l.unit AS unite, l.hs_code AS code_sh, l.origin_country AS origine, s.updated_at AS maj_le
FROM vector.packages p JOIN vector.shipments s ON s.id = p.shipment_id LEFT JOIN vector.package_lines l ON l.package_id = p.id`;

/** vector.pub_demandes — shipment requests and their state (Keystone's project screen); no value. */
export const PUB_DEMANDES = `SELECT r.ref AS demande_ref, r.origin AS origine, r.title AS titre, r.project_code AS projet_code, r.cost_code AS code_cout, r.ready_on AS prete_le,
       r.needed_on AS besoin_le, r.urgency AS urgence, r.state AS statut,
       (SELECT string_agg(s.ref, ', ' ORDER BY s.ref) FROM vector.shipment_allocations a JOIN vector.shipments s ON s.id = a.shipment_id WHERE a.request_id = r.id) AS expeditions,
       r.updated_at AS maj_le
FROM vector.shipment_requests r`;

/** vector.pub_couts_expeditions — costs per shipment, category and imputation (Keystone's Finance role, Matrix). */
export const PUB_COUTS_EXPEDITIONS = `SELECT s.ref AS expedition_ref, r.project_code AS projet_code, r.cost_code AS code_cout, c.category AS categorie, c.currency AS devise,
       c.quoted AS cote, c.invoiced AS facture, c.invoice_date AS facture_le, c.reconciled AS rapproche, c.updated_at AS maj_le
FROM vector.cost_lines c JOIN vector.shipments s ON s.id = c.shipment_id
LEFT JOIN LATERAL (SELECT r.project_code, r.cost_code FROM vector.shipment_allocations a JOIN vector.shipment_requests r ON r.id = a.request_id
                   WHERE a.shipment_id = s.id ORDER BY r.ref LIMIT 1) r ON true`;

export const PUBLICATIONS = {
  pub_expeditions: PUB_EXPEDITIONS, pub_colis: PUB_COLIS, pub_demandes: PUB_DEMANDES, pub_couts_expeditions: PUB_COUTS_EXPEDITIONS,
} as const;

/** Columns of the R-158 v1 contract, in order (vector.pub_expeditions starts with them). */
export const R158_COLUMNS = [
  'projet_code', 'expedition_ref', 'equipements', 'statut', 'mode', 'incoterm', 'incoterm_lieu', 'origine', 'destination', 'etd', 'eta',
  'depart_reel_le', 'arrivee_reelle_le', 'receptionnee_le', 'nb_chargements', 'nb_reserves_ouvertes', 'maj_le',
] as const;
