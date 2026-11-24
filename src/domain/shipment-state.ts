// State machine of a shipment (docs/spec/01 § 4). Pure: the caller passes the facts it read; the rule says which transitions
// are open and why the others are blocked. The Server Function re-reads the facts inside its transaction and asks again.
import type { ShipmentState } from './vocab';

/** What the rules need to know about a shipment. */
export interface ShipmentFacts {
  state: ShipmentState;
  /** The state before `on_hold` (to resume). */
  previousState: ShipmentState | null;
  hasRoute: boolean;
  hasMode: boolean;
  hasIncoterm: boolean;
  packages: number;
  packagesMeasured: boolean;
  packingValidated: boolean;
  awardedQuote: boolean;
  booking: boolean;
  international: boolean;
  /** Every compliance check is ok, na or waived. */
  complianceCleared: boolean;
  /** Export out of the EU: an MRN is needed before departure. */
  needsMrn: boolean;
  hasMrn: boolean;
  /** Documents due before pick-up still missing (expected, rejected). */
  missingBeforePickup: number;
  pickedUpOn: string | null;
  departedOn: string | null;
  arrivedOn: string | null;
  deliveredOn: string | null;
  podReference: boolean;
  openIncidents: number;
  /** Every invoiced cost line is reconciled (or none invoiced yet and the manager forces). */
  costsReconciled: boolean;
}

export type Transition = 'plan' | 'book' | 'pickup' | 'depart' | 'arrive' | 'deliver' | 'close' | 'cancel' | 'hold' | 'resume' | 'reopen';

/** Target state of each forward transition. */
export const TRANSITION_TARGET: Record<Exclude<Transition, 'resume' | 'reopen'>, ShipmentState> = {
  plan: 'planned', book: 'booked', pickup: 'picked_up', depart: 'in_transit', arrive: 'arrived', deliver: 'delivered', close: 'closed',
  cancel: 'cancelled', hold: 'on_hold',
};

/** EN source labels of the transition buttons. */
export const TRANSITION_LABEL: Record<Transition, string> = {
  plan: 'Mark planned', book: 'Mark booked', pickup: 'Mark picked up', depart: 'Mark departed', arrive: 'Mark arrived',
  deliver: 'Mark delivered', close: 'Close shipment', cancel: 'Cancel shipment', hold: 'Put on hold', resume: 'Resume', reopen: 'Back to draft',
};

/** Transitions that need a typed reason. */
export const NEEDS_REASON: readonly Transition[] = ['cancel', 'hold', 'reopen'];

const FORWARD: Record<ShipmentState, Transition | null> = {
  draft: 'plan', planned: 'book', booked: 'pickup', picked_up: 'depart', in_transit: 'arrive', arrived: 'deliver', delivered: 'close',
  closed: null, cancelled: null, on_hold: null,
};

/** The next forward transition of a state (none for closed, cancelled, on hold). */
export const forwardOf = (s: ShipmentState): Transition | null => FORWARD[s];

const HOLDABLE: readonly ShipmentState[] = ['planned', 'booked', 'picked_up', 'in_transit', 'arrived'];
const CANCELLABLE: readonly ShipmentState[] = ['draft', 'planned', 'booked'];

/**
 * Why a transition is refused (EN source strings); an empty list means it is allowed. `force` (the manager closing with a
 * reason) lifts the cost reconciliation condition of `close` only.
 */
export function blockers(t: Transition, f: ShipmentFacts, opts: { force?: boolean } = {}): string[] {
  const b: string[] = [];
  switch (t) {
    case 'plan':
      if (f.state !== 'draft') b.push('Only a draft can be planned');
      if (!f.hasRoute) b.push('Departure and arrival are required');
      if (!f.hasMode) b.push('The transport mode is required');
      if (!f.hasIncoterm) b.push('The Incoterm is required');
      if (f.packages === 0) b.push('At least one package is required');
      else if (!f.packagesMeasured) b.push('Every package needs its dimensions and weights');
      break;
    case 'book':
      if (f.state !== 'planned') b.push('Only a planned shipment can be booked');
      if (!f.packingValidated) b.push('The packing list is not validated');
      if (!f.awardedQuote) b.push('No quote is awarded');
      if (!f.booking) b.push('The booking (number and carrier) is missing');
      if (f.international && !f.complianceCleared) b.push('The export compliance checklist is not cleared');
      break;
    case 'pickup':
      if (f.state !== 'booked') b.push('Only a booked shipment can be picked up');
      if (!f.pickedUpOn) b.push('The actual pick-up date is missing');
      if (f.missingBeforePickup > 0) b.push('Documents due before pick-up are missing');
      break;
    case 'depart':
      if (f.state !== 'picked_up') b.push('Only a picked-up shipment can depart');
      if (!f.departedOn) b.push('The actual departure date (ATD) is missing');
      if (f.needsMrn && !f.hasMrn) b.push('The export declaration (MRN) is missing');
      break;
    case 'arrive':
      if (f.state !== 'in_transit') b.push('Only a shipment in transit can arrive');
      if (!f.arrivedOn) b.push('The actual arrival date (ATA) is missing');
      else if (f.departedOn && f.arrivedOn < f.departedOn) b.push('The arrival is before the departure');
      break;
    case 'deliver':
      if (f.state !== 'arrived') b.push('Only an arrived shipment can be delivered');
      if (!f.deliveredOn) b.push('The delivery date is missing');
      if (!f.podReference) b.push('The proof of delivery is missing');
      break;
    case 'close':
      if (f.state !== 'delivered') b.push('Only a delivered shipment can be closed');
      if (f.openIncidents > 0) b.push('Incidents are still open');
      if (!f.costsReconciled && !opts.force) b.push('Invoiced costs are not reconciled');
      break;
    case 'cancel':
      if (!CANCELLABLE.includes(f.state)) b.push('A shipment can no longer be cancelled once picked up');
      break;
    case 'hold':
      if (!HOLDABLE.includes(f.state)) b.push('This shipment cannot be put on hold');
      break;
    case 'resume':
      if (f.state !== 'on_hold' || !f.previousState) b.push('The shipment is not on hold');
      break;
    case 'reopen':
      if (f.state !== 'planned') b.push('Only a planned shipment goes back to draft');
      break;
  }
  return b;
}

/** The state a transition leads to. */
export function targetOf(t: Transition, f: Pick<ShipmentFacts, 'state' | 'previousState'>): ShipmentState {
  if (t === 'resume') return f.previousState ?? f.state;
  if (t === 'reopen') return 'draft';
  return TRANSITION_TARGET[t];
}

/** Open = moving goods or about to (drives the "in progress" counts and the map). */
export const isOpenState = (s: ShipmentState) => s === 'planned' || s === 'booked' || s === 'picked_up' || s === 'in_transit' || s === 'arrived' || s === 'on_hold';

/** Status of the shared contract R-158 v1 (keystone.pub_expeditions, kept by vector.pub_expeditions — docs/spec/05 § 4). */
export function keystoneStatusOf(s: ShipmentState, previous: ShipmentState | null, receivedByKeystone: boolean): string {
  const base = s === 'on_hold' || s === 'cancelled' ? previous ?? 'draft' : s;
  switch (base) {
    case 'draft':
    case 'planned':
      return 'draft';
    case 'booked':
      return 'prepared';
    case 'delivered':
      return receivedByKeystone ? 'received' : 'arrived';
    default:
      return base;
  }
}
