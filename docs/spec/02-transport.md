# 02 — Transporteurs, appels d'offres, réservation, suivi

## 1. Annuaire

Un **partenaire** : raison sociale, pays, type (`carrier` transporteur, `forwarder` transitaire / commissionnaire,
`express` intégrateur, `packer` emballeur, `insurer` assureur, `agent` agent en destination, `customs_broker`
commissionnaire en douane), modes servis, zones (continents, pays), agréments (OEA / AEO, IATA, FIATA), contacts
professionnels (nom, fonction, e-mail et téléphone professionnels du partenaire — jamais une donnée personnelle d'un
salarié du groupe), état `active` / `suspended` (motif) / `archived`. Un partenaire suspendu ne reçoit plus de RFQ.

**Performance** (calculée, jamais stockée, `src/domain/kpi.ts`), par partenaire et période :
- ponctualité : part des expéditions livrées au plus tard à l'ETA confirmée à la réservation (+ tolérance réglable,
  1 jour par défaut) ;
- délai de réponse aux RFQ (médiane en heures), taux de réponse ;
- taux d'attribution (attribuées / cotées) ;
- incidents par 100 expéditions, dont avaries ;
- écart moyen facture / cotation attribuée (%) ;
- note globale (pondération réglable, question D-11).

## 2. Appel d'offres (RFQ) et cotations

- Une RFQ porte sur une expédition (ou une partie : pré-acheminement, transport principal) ; elle reprend le colisage
  (sans les valeurs, sauf assurance demandée) et est envoyée à N partenaires (3 par défaut, réglable ; `D-6`).
- L'envoi est un **message préparé** (texte et pièce jointe de colisage) à copier dans la messagerie, ou mis dans la file
  d'envoi e-mail quand la DSI aura choisi le transport (comme Clavis) ; aucun portail transporteur au départ (`D-15`).
- Une **cotation** : partenaire, montant total et détail (fret, surcharges carburant / BAF / CAF, frais de port THC,
  documentation, douane, assurance, post-acheminement), devise, délai de transit (jours), date de départ proposée,
  validité, conditions (exclusions), référence du devis (Codex).
- **Comparaison** (`src/domain/quotes.ts`) : montants convertis en euros au cours du jour (table des cours, Arche AR-039
  comme modèle), classement par coût total, par délai, et par « valeur » = coût + pénalité de retard estimée ; écart à
  l'estimation ; alerte si validité dépassée.
- **Attribution** : une cotation retenue (motif obligatoire si ce n'est pas la moins chère) ; au-delà du seuil
  `award_approval_eur` (10 000 € par défaut, `D-5`), validation par le responsable des expéditions ; les autres cotations
  passent à `declined`. Une expédition urgente (`critical`) peut être attribuée sans RFQ (dérogation journalisée).

## 3. Réservation

N° de réservation (booking) du transporteur, navire et voyage / vol / immatriculation, ports, **cut-offs** (documents,
VGM — masse brute vérifiée SOLAS —, marchandise), ETD / ETA confirmées, n° de conteneurs et plombs, B/L ou AWB maître et
fils. Les cut-offs alimentent le calendrier et les alertes (« cut-off documents dans 48 h et EX-A non reçu »).

## 4. Suivi par jalons

Jalons standard (prévu / réel, lieu, note), selon le mode :

| Code | Jalon | Route | Mer | Air | Express |
| --- | --- | --- | --- | --- | --- |
| `ready` | marchandise prête | ● | ● | ● | ● |
| `pickup` | enlèvement | ● | ● | ● | ● |
| `export_cleared` | dédouanement export (MRN / EX-A) | ◐ (hors UE) | ● | ● | ● |
| `gate_in` | entrée au terminal / dépôt |  | ● | ● |  |
| `loaded` | embarquement / chargement |  | ● | ● |  |
| `departed` | départ du transport principal (ATD) | ● | ● | ● | ● |
| `transshipment` | transbordement |  | ◐ | ◐ |  |
| `arrived` | arrivée (ATA) | ● | ● | ● | ● |
| `import_cleared` | dédouanement import | ◐ | ● | ● | ● |
| `out_for_delivery` | post-acheminement |  | ● | ● | ● |
| `delivered` | livraison (POD) | ● | ● | ● | ● |

- **ETA courante** = dernière ETA saisie, sinon ETA confirmée de la réservation, sinon ETD + délai de transit coté.
- **Retard** (`src/domain/eta.ts`) : jours entre la date de besoin de la demande et l'ETA courante (retard prévisionnel),
  ou entre l'ETA confirmée et la livraison réelle (retard réalisé) ; un jalon prévu dépassé sans date réelle est « en
  retard » ; seuils d'alerte réglables.
- **Saisie** à la main au départ (depuis les e-mails du transitaire). Connecteur de suivi (`src/server/integrations/tracking/`)
  **simulé** : il produit des événements de jalons comme le ferait une API (project44, Shippeo, API DCSA des compagnies
  maritimes, API des intégrateurs) ; branché réellement après accord de la DSI (`D-14`).

## 5. Calendrier

Vue semaine et mois : départs (ETD / ATD), arrivées (ETA / ATA), cut-offs, dates de besoin, dates limites d'expédition des
lettres de crédit ; filtre par site, mode, responsable. Pas de vue Gantt au départ.

## 6. Carte des flux

Vue SVG sans tuile extérieure (aucun appel réseau) : planisphère simplifié en coordonnées équirectangulaires (contours
embarqués, ou à défaut une grille et les points des sites), sites du groupe (coordonnées de `matrix.pub_sites` quand
publiées, sinon de la liste de démonstration), ports et aéroports utilisés, une ligne par expédition en cours (couleur
selon l'état, tiret pour le retard), au survol la référence et l'ETA. La charte autorise `d3-geo` / `world-atlas` si un
fond plus fin est demandé.
