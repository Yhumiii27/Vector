# 04 — Incidents, livraison, coûts, indicateurs

## 1. Incidents et réclamations

| Champ | Règle |
| --- | --- |
| Référence | `INC-AAAA-NNNN` |
| Type | `delay`, `damage` (avarie), `loss` (perte), `shortage` (manquant), `customs_hold` (blocage douane), `documents` (document erroné, réserve de LC), `safety` (incident de sécurité : renvoyé à Vigie), `other` |
| Gravité | `minor`, `major`, `critical` |
| Constat | date, lieu, description, réserves écrites sur la lettre de transport (oui / non : condition de recours), photos (Codex) |
| Réclamation | montant réclamé et devise, destinataire (transporteur ou assureur), date d'envoi, **délai de réclamation** calculé selon le régime (CMR : réserves à la livraison ou sous 7 jours pour une avarie non apparente, prescription 1 an ; Convention de Montréal (air) : 14 jours pour une avarie, 21 jours pour un retard ; Règles de La Haye-Visby (mer) : 3 jours pour une avarie non apparente, prescription 1 an), montant obtenu |
| État | `open` → `claimed` → `settled` · `rejected` · `closed` (motif) |

Un incident `safety` ou impliquant une marchandise dangereuse crée un signalement préparé pour Vigie (file d'envoi,
`src/server/integrations/vigie/`) ; Vigie reste propriétaire de l'événement HSE.

## 2. Livraison et réception

- **POD** : date et heure, signataire (texte saisi), réserves, référence Codex du document signé.
- Pour une expédition d'un projet Keystone, le **pointage colis par colis et les réserves** restent dans Keystone
  (écran Expéditions, punch list R-185) ; Vector lit l'état de réception (`keystone.pub_receptions_expeditions`, à
  demander) et ne le recopie pas (question T-4). Hors projet, la réception se confirme dans Vector par le demandeur.

## 3. Coûts

Lignes de coût d'une expédition : catégorie (`freight`, `surcharges`, `port_handling`, `customs`, `duties_taxes`,
`insurance`, `packing`, `storage`, `demurrage` (surestaries conteneur), `detention`, `other`), partenaire, montant,
devise, et pour chaque ligne :

- **estimé** (à la demande, depuis les standards de coût : €/kg par mode et zone, table `cost_standards`) ;
- **coté** (cotation attribuée) ;
- **facturé** (facture du partenaire, saisie ou lue dans Sage : n° de facture, date, montant) ;
- **imputation** : projet Keystone et poste (catégorie du budget du projet) ou code de coût ; ventilation entre
  demandes groupées au prorata du poids taxable (règle par défaut, `D-7`).

Écarts calculés (`src/domain/costs.ts`) : facturé – coté (€ et %) ; seuil d'alerte réglable (5 % par défaut). Un écart au-
delà du seuil demande un motif avant le rapprochement. Les montants sont convertis en euros au cours de la date de la
facture (table `exchange_rates`, saisie ou lue plus tard).

## 4. Indicateurs (calculés, jamais stockés)

| Indicateur | Définition |
| --- | --- |
| Expéditions en cours | états `planned` → `arrived` |
| Livraisons à l'heure (OTD) | livrées ≤ date de besoin (+ tolérance) / livrées sur la période |
| Ponctualité transporteur (OTIF) | livrées ≤ ETA confirmée et sans incident de manquant / livrées |
| Retards prévisionnels | ETA courante > date de besoin |
| Délai moyen demande → départ | médiane en jours ouvrés |
| Délai de transit moyen par mode et route | ATA – ATD |
| Coût du fret / valeur expédiée | % par mode |
| Coût au kg taxable | € / kg par mode et zone |
| Écart facture / cotation | moyenne pondérée |
| Part de l'aérien | en poids taxable et en coût (suivi des urgences) |
| Incidents pour 100 expéditions | par type |
| Documents en retard | attendus dont l'échéance est passée |
| Émissions de CO₂ estimées | t·km × facteur par mode (option `D-13`, facteurs à fournir) |

Rapports : tableau de bord d'accueil, page Rapports (période, site, mode, partenaire), exports CSV de chaque liste.
