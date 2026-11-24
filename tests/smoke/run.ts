// Smoke test of a running Vector (production build, demo data set): health, every screen for the shipping manager, what a
// requester and a reader may see (no values, own shipments only), a shipment sheet and its tabs, a printable document, the CSV
// exports, the security headers and the French rendering.
//   VECTOR_SMOKE_URL=http://127.0.0.1:3910 npx tsx tests/smoke/run.ts
const BASE = (process.env.VECTOR_SMOKE_URL || 'http://127.0.0.1:3910').replace(/\/+$/, '');

let failures = 0;
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures++;
}

async function get(path: string, role?: string): Promise<{ status: number; body: string; headers: Headers }> {
  const r = await fetch(BASE + path, { headers: role ? { cookie: `vector-role=${role}` } : {}, redirect: 'manual' });
  return { status: r.status, body: await r.text(), headers: r.headers };
}

async function main(): Promise<void> {
  const health = await get('/api/health');
  check(health.status === 200, 'GET /api/health answers 200');

  const home = await get('/', 'manager');
  check(home.status === 200 && home.body.includes('Les expéditions en un coup d’œil'), 'the home page opens in French by default');
  check(home.body.includes('SH-2026-0103'), 'the home page shows the shipment forecast late');
  const csp = home.headers.get('content-security-policy') ?? '';
  check(csp.includes("default-src 'self'") && csp.includes('nonce-'), 'the page carries a Content-Security-Policy with a nonce');
  check(home.headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options: nosniff');
  // Norma 2.0 common shell (norma/charte/COQUE.md): the language / display pair stacked, in the page header and the top bar
  // (≤ 1024 px) and never in the sidebar, the menu button of the top bar, the page's only <h1>, no tool name in the breadcrumb.
  const prefs = home.body.match(/class="coque-prefs"/g) ?? [];
  const aside = /<aside[^>]*id="coque-sidebar"[\s\S]*?<\/aside>/.exec(home.body)?.[0] ?? '';
  check(prefs.length === 2 && home.body.includes('aria-label="Langue"') && home.body.includes('aria-label="Affichage"'), 'language over display pair, in the page header and the top bar');
  check(aside.length > 0 && !aside.includes('coque-prefs') && aside.includes('coque-pagesearch'), 'the sidebar has the ⌘K page search and no language / display pair');
  check(home.body.includes('id="coque-nav-toggle"') && home.body.includes('aria-controls="coque-sidebar"') && home.body.includes('>Menu<'), 'menu button of the top bar (compact layout)');
  check((home.body.match(/<h1[ >]/g) ?? []).length === 1 && home.body.includes('class="coque-title"'), 'one page title <h1>');
  const crumb = /class="coque-crumb">([\s\S]*?)<\/div>/.exec(home.body)?.[1] ?? '';
  check(!crumb.includes('Vector'), 'the breadcrumb does not repeat the tool name');

  for (const [path, text] of [
    ['/requests', 'Demandes d’expédition'], ['/shipments', 'SH-2026-0104'], ['/shipments?state=all', 'SH-2026-0111'], ['/rfq', 'RFQ-2026-0105'],
    ['/incidents', 'INC-2026-0012'], ['/partners', 'Fret Boréal'], ['/customs', 'Codes SH utilisés'], ['/calendar', 'Départs et arrivées'], ['/map', 'Carte des flux'],
    ['/reports', 'Ponctualité des transporteurs'], ['/admin', 'Incoterms 2020'], ['/admin/connectors', 'File d’envoi'], ['/journal', 'Exporter (CSV)'],
  ] as const) {
    const r = await get(path, 'manager');
    check(r.status === 200 && r.body.includes(text), `${path} opens for the shipping manager`);
  }
  for (const tab of ['', '?tab=packing', '?tab=transport', '?tab=tracking', '?tab=documents', '?tab=incidents', '?tab=costs', '?tab=journal']) {
    const r = await get(`/shipments/SH-2026-0104${tab}`, 'manager');
    check(r.status === 200 && r.body.includes('SH-2026-0104'), `the shipment sheet ${tab || '(summary)'} opens`);
  }
  const lc = await get('/shipments/SH-2026-0104?tab=documents', 'manager');
  check(lc.body.includes('Déclaration de marchandises dangereuses') && lc.body.includes('Certificat d’assurance'), 'the document checklist follows the goods and the payment');
  const print = await get('/print/shipments/SH-2026-0103/packing_list', 'manager');
  check(print.status === 200 && print.body.includes('Liste de colisage') && print.body.includes('84798997'), 'the packing list prints with its HS codes');
  const csv = await get('/export/shipments', 'manager');
  check(csv.status === 200 && (csv.headers.get('content-type') ?? '').startsWith('text/csv') && csv.body.includes('value_eur'), 'the shipments export as CSV with values for the manager');

  const reader = await get('/export/shipments', 'reader');
  check(reader.status === 200 && !reader.body.includes('value_eur'), 'a reader exports without values');
  check((await get('/export/costs', 'reader')).status === 404, 'a reader gets no cost export');
  const readerCosts = await get('/shipments/SH-2026-0101?tab=costs', 'reader');
  check(readerCosts.body.includes('Les coûts ne sont montrés'), 'a reader does not see the costs');
  check((await get('/print/shipments/SH-2026-0101/proforma_invoice', 'reader')).status === 404, 'a reader cannot print a proforma invoice');

  const requester = await get('/shipments?state=all', 'requester');
  check(requester.status === 200 && requester.body.includes('SH-2026-0102'), 'a requester sees the shipments of their requests');
  check((await get('/admin', 'requester')).body.includes('Lecture seule') || (await get('/admin', 'requester')).status === 200, 'administration is read-only for a requester');

  check((await get('/shipments/SH-2099-0001', 'manager')).status === 404, 'an unknown shipment is not found');
  check((await get('/nowhere', 'manager')).status === 404, 'an unknown path is not found');
  check((await get('/sign-in')).status === 307, 'the sign-in page leads home in demo mode');

  if (failures) {
    console.error(`\n${failures} smoke check(s) failed`);
    process.exit(1);
  }
  console.log('\nSmoke test passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
