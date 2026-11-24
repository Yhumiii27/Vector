// Smoke test of a running Vector (production build, demo data set): health, the organisational chart and an employee sheet
// for each Vector role ("View as"), what a plain user may see, the security headers and the French rendering.
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

/** The employee sheet links of the chart (?fiche=<uuid>). */
const sheetIds = (html: string) => [...new Set(html.match(/\?fiche=([0-9a-f-]{36})/g) ?? [])].map((m) => m.slice(7));

async function main(): Promise<void> {
  const health = await get('/api/health');
  check(health.status === 200, 'GET /api/health answers 200');

  const chart = await get('/', 'admin');
  check(chart.status === 200, 'the organisational chart opens for the IT administrator');
  check(chart.body.includes('Organigramme'), 'the page is in French by default');
  check(chart.body.includes('Hélène Marchal') && chart.body.includes('Mehdi Lambert'), 'the chart lists the demo company from the top to the teams');
  const ids = sheetIds(chart.body);
  check(ids.length === 12, `every person of the demo company has a sheet link (${ids.length})`);
  const csp = chart.headers.get('content-security-policy') ?? '';
  check(csp.includes("default-src 'self'") && csp.includes('nonce-'), 'the page carries a Content-Security-Policy with a nonce');
  check(chart.headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options: nosniff');

  const sheet = await get(`/?fiche=${ids[0]}`, 'admin');
  check(sheet.status === 200 && sheet.body.includes('Fiche employé') && sheet.body.includes('Droits dans les outils'), 'an employee sheet opens beside the chart');
  check(['Keystone', 'Codex', 'Matrix', 'Cursus', 'Vigie', 'Crucible', 'Arche'].every((a) => sheet.body.includes(a)), 'the sheet lists the seven applications');

  const reader = await get(`/?fiche=${ids[0]}`, 'reader');
  check(reader.status === 200 && reader.body.includes('Organigramme'), 'a reader sees the chart and the sheets');

  const user = await get('/', 'user');
  check(user.status === 200 && user.body.includes('Mes accès'), 'a plain user sees their own accesses');
  check(sheetIds(user.body).length === 0, 'a plain user does not see the chart of the company');
  const other = await get(`/?fiche=${ids[0]}`, 'user');
  check(!other.body.includes('Hélène Marchal') || other.body.includes('Lucie Fontaine'), 'a plain user cannot open someone else’s sheet');

  // Lot A: the journal (read, exported as CSV), the directory import screen; neither open to a plain user.
  const journal = await get('/journal', 'admin');
  check(journal.status === 200 && journal.body.includes('Exporter (CSV)'), 'the journal opens for the IT administrator, with its export');
  const csv = await get('/journal/export', 'reader');
  check(csv.status === 200 && (csv.headers.get('content-type') ?? '').startsWith('text/csv') && csv.body.includes('date;acteur;role_acteur'), 'the journal exports as CSV for a reader');
  check((await get('/journal/export', 'user')).status === 404, 'a plain user cannot export the journal');
  const importPage = await get('/directory/import', 'admin');
  check(importPage.status === 200 && importPage.body.includes('Importer la liste des salariés'), 'the directory import screen opens for the IT administrator');
  check((await get('/directory/import', 'reader')).status === 404, 'a reader does not open the directory import');
  check(sheet.body.includes('Enregistrer le départ'), 'the sheet offers the departure in one gesture');

  check((await get('/nowhere', 'admin')).status === 404, 'an unknown path is not found');
  check((await get('/sign-in')).status === 307, 'the sign-in page leads home in demo mode');

  if (failures) {
    console.error(`${failures} smoke check(s) failed`);
    process.exit(1);
  }
  console.log('All smoke checks passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
