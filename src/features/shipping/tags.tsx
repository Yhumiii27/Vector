// State tags (Nocturne: severity is accent intensity, never a hard-coded colour). Server-compatible.
import { Tag, type TagTone } from '@norma/charte/ds/Tag';
import {
  CHECK_STATE_LABEL, DOCUMENT_STATE_LABEL, INCIDENT_STATE_LABEL, QUOTE_STATE_LABEL, REQUEST_STATE_LABEL, SEVERITY_LABEL, SHIPMENT_STATE_LABEL, URGENCY_LABEL,
  type CheckState, type DocumentState, type IncidentState, type QuoteState, type RequestState, type Severity, type ShipmentState, type Urgency,
} from '@/domain/vocab';
import type { T } from '@/i18n/translate';

const SHIPMENT_TONE: Record<ShipmentState, TagTone> = {
  draft: 'neutral', planned: 'outline', booked: 'outline', picked_up: 'accent', in_transit: 'accent', arrived: 'accent-2', delivered: 'neutral', closed: 'neutral', cancelled: 'neutral', on_hold: 'accent-2',
};

export const ShipmentTag = ({ state, t }: { state: string; t: T }) => <Tag tone={SHIPMENT_TONE[state as ShipmentState] ?? 'neutral'}>{t(SHIPMENT_STATE_LABEL[state as ShipmentState] ?? state)}</Tag>;
export const RequestTag = ({ state, t }: { state: string; t: T }) => <Tag tone={state === 'submitted' ? 'accent' : state === 'accepted' ? 'outline' : 'neutral'}>{t(REQUEST_STATE_LABEL[state as RequestState] ?? state)}</Tag>;
export const UrgencyTag = ({ urgency, t }: { urgency: string; t: T }) =>
  urgency === 'normal' ? null : <Tag tone={urgency === 'critical' ? 'accent' : 'accent-2'}>{t(URGENCY_LABEL[urgency as Urgency])}</Tag>;
export const CheckTag = ({ state, t }: { state: string; t: T }) => <Tag tone={state === 'blocked' ? 'accent' : state === 'pending' ? 'accent-2' : 'neutral'}>{t(CHECK_STATE_LABEL[state as CheckState] ?? state)}</Tag>;
export const DocTag = ({ state, late, t }: { state: string; late: boolean; t: T }) =>
  state === 'missing' ? <Tag tone={late ? 'accent' : 'outline'}>{t(late ? 'Late' : 'Missing')}</Tag> : <Tag tone={state === 'rejected' ? 'accent' : state === 'expected' ? 'outline' : 'neutral'}>{t(DOCUMENT_STATE_LABEL[state as DocumentState] ?? state)}</Tag>;
export const IncidentTag = ({ state, t }: { state: string; t: T }) => <Tag tone={state === 'open' ? 'accent' : state === 'claimed' ? 'accent-2' : 'neutral'}>{t(INCIDENT_STATE_LABEL[state as IncidentState] ?? state)}</Tag>;
export const SeverityTag = ({ severity, t }: { severity: string; t: T }) => <Tag tone={severity === 'critical' ? 'accent' : severity === 'major' ? 'accent-2' : 'outline'}>{t(SEVERITY_LABEL[severity as Severity] ?? severity)}</Tag>;
export const QuoteTag = ({ state, t }: { state: string; t: T }) => <Tag tone={state === 'awarded' ? 'accent' : state === 'received' ? 'outline' : 'neutral'}>{t(QUOTE_STATE_LABEL[state as QuoteState] ?? state)}</Tag>;
export const LateTag = ({ days, t }: { days: number | null; t: T }) => (days != null && days > 0 ? <Tag tone="accent">{t('Late')} +{days} {t('d')}</Tag> : null);
