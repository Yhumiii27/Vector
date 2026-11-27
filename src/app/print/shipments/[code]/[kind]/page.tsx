// Printable documents of Vector (docs/spec/03 § 3.2): packing list, package marks, proforma invoice, shipping instructions, CMR
// data and VGM — generic layouts until the company's formats (question D-12). Outside the app shell, printed or saved as PDF by the
// browser; the same rights as the shipment sheet (404 outside the viewer's scope; values only for the roles of U-2).
import { notFound } from 'next/navigation';
import { canSeeValues } from '@/domain/rights';
import { packageMark } from '@/domain/packing';
import { DOCUMENT_KIND_LABEL, MODE_LABEL, PACKAGE_TYPE_LABEL, type Mode, type PackageType } from '@/domain/vocab';
import p from '@/features/shipping/print.module.css';
import { fmtDate, fmtMoney, fmtNum } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { shipmentByRef } from '@/server/dal/world';
import { getI18n, getViewer } from '@/server/session';

const KINDS = ['packing_list', 'marks', 'proforma_invoice', 'shipping_instructions', 'cmr', 'vgm'] as const;
type Kind = (typeof KINDS)[number];

export default async function PrintPage({ params }: { params: Promise<{ code: string; kind: string }> }) {
  const [{ code, kind }, { t, lang }, viewer, today] = await Promise.all([params, getI18n(), getViewer(), businessToday()]);
  if (!(KINDS as readonly string[]).includes(kind)) notFound();
  const found = await shipmentByRef(viewer, today, decodeURIComponent(code));
  if (!found) notFound();
  const { view: v } = found;
  const k = kind as Kind;
  const values = canSeeValues(viewer.roles);
  if (k === 'proforma_invoice' && !values) notFound();
  const from = v.from?.name ?? v.s.fromAddress ?? '';
  const to = v.to?.name ?? v.s.toAddress ?? '';
  const head = (
    <header className={p.head}>
      <div>
        <div className={p.kind}>{t(DOCUMENT_KIND_LABEL[k])}</div>
        <h1 className={p.title}>{v.s.ref}</h1>
        <div>{v.s.title}</div>
      </div>
      <dl className={p.meta}>
        <dt>{t('Shipper')}</dt><dd>{from} ({v.s.fromCountry})</dd>
        <dt>{t('Consignee')}</dt><dd>{to} ({v.s.toCountry})</dd>
        <dt>{t('Mode')}</dt><dd>{t(MODE_LABEL[v.s.mode as Mode])} · {v.s.portOfLoading ?? ''} → {v.s.portOfDischarge ?? ''}</dd>
        <dt>{t('Incoterm')}</dt><dd>{v.s.incoterm} {v.s.incotermPlace}</dd>
        <dt>{t('Date')}</dt><dd>{fmtDate(today, lang)}</dd>
      </dl>
    </header>
  );
  return (
    <main className={p.page}>
      {head}
      {(k === 'packing_list' || k === 'proforma_invoice' || k === 'shipping_instructions' || k === 'cmr') && (
        <table className={p.table}>
          <thead><tr><th>{t('No.')}</th><th>{t('Package')}</th><th>{t('Content')}</th><th>{t('HS code')}</th><th>{t('Origin')}</th><th>{t('L × W × H (cm)')}</th><th>{t('Gross')}</th><th>{t('Net')}</th>{k === 'proforma_invoice' && <th>{t('Value')}</th>}</tr></thead>
          <tbody>
            {v.packages.flatMap((pk) => (pk.lines.length ? pk.lines : [null]).map((l, i) => (
              <tr key={`${pk.id}-${i}`}>
                <td>{i === 0 ? pk.number : ''}</td>
                <td>{i === 0 ? `${t(PACKAGE_TYPE_LABEL[pk.type as PackageType])} · ${pk.description}` : ''}</td>
                <td>{l ? `${fmtNum(l.quantity, lang, 3)} × ${l.description}${l.unNumber ? ` · ${l.unNumber} ${t('class')} ${l.dgClass}` : ''}` : ''}</td>
                <td>{l?.hsCode ?? ''}</td><td>{l?.originCountry ?? ''}</td>
                <td>{i === 0 ? `${pk.lengthCm} × ${pk.widthCm} × ${pk.heightCm}` : ''}</td>
                <td>{i === 0 ? `${fmtNum(pk.grossKg, lang)} kg` : ''}</td><td>{i === 0 ? `${fmtNum(pk.netKg, lang)} kg` : ''}</td>
                {k === 'proforma_invoice' && <td>{l ? fmtMoney(l.quantity * l.unitValue, l.currency, lang) : ''}</td>}
              </tr>
            )))}
          </tbody>
          <tfoot><tr><td colSpan={6}>{t('Total')} · {v.totals.packages} {t('packages')} · {fmtNum(v.totals.volumeM3, lang, 3)} m³</td><td>{fmtNum(v.totals.grossKg, lang)} kg</td><td>{fmtNum(v.totals.netKg, lang)} kg</td>{k === 'proforma_invoice' && <td>{Object.entries(v.values).map(([c, n]) => fmtMoney(n, c, lang)).join(' + ')}</td>}</tr></tfoot>
        </table>
      )}
      {k === 'proforma_invoice' && <p className={p.note}>{t('Proforma invoice for customs purposes only: no payment is due on it.')}</p>}
      {k === 'shipping_instructions' && <p className={p.note}>{t('Please issue the bill of lading or the air waybill with the data above; notify the consignee on arrival.')} {v.booking ? `${t('Booking')} ${v.booking.number}.` : ''}</p>}
      {k === 'cmr' && <p className={p.note}>{t('Data of the CMR consignment note (convention on the contract for the international carriage of goods by road).')} {t('Carrier')}: {v.carrierName ?? '—'}.</p>}
      {k === 'marks' && (
        <div className={p.marks}>
          {v.packages.map((pk) => (
            <div key={pk.id} className={p.mark}>
              <div className={p.markRef}>{packageMark(v.s.ref, pk.number, v.packages.length)}</div>
              <div>{to} · {v.s.toCountry}</div>
              <div>{pk.lengthCm} × {pk.widthCm} × {pk.heightCm} cm · {fmtNum(pk.grossKg, lang)} kg</div>
              {!pk.stackable && <div className={p.warn}>{t('DO NOT STACK')}</div>}
              {pk.lines.some((l) => l.unNumber) && <div className={p.warn}>{pk.lines.filter((l) => l.unNumber).map((l) => `${l.unNumber} · ${t('class')} ${l.dgClass}`).join(', ')}</div>}
            </div>
          ))}
        </div>
      )}
      {k === 'vgm' && (
        <table className={p.table}>
          <thead><tr><th>{t('Container')}</th><th>{t('Seal')}</th><th>{t('Cargo gross weight')}</th></tr></thead>
          <tbody>{v.loads.filter((l) => ['c20', 'c40', 'c40hc', 'open_top', 'flat_rack'].includes(l.type)).map((l) => (
            <tr key={l.id}><td>{l.identifier ?? '—'}</td><td>{l.seal ?? '—'}</td><td>{fmtNum(v.packages.filter((x) => x.loadId === l.id).reduce((n, x) => n + x.grossKg, 0), lang)} kg</td></tr>
          ))}</tbody>
        </table>
      )}
      {k === 'vgm' && <p className={p.note}>{t('Verified gross mass (SOLAS): add the tare of each container before transmission to the carrier.')}</p>}
      <footer className={p.foot}>{t('Generic layout, until the standard formats of the company (question D-12). Filed in Codex once generated.')}</footer>
    </main>
  );
}
