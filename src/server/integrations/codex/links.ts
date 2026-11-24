// Deep links to Codex (Norma § 5): Vector keeps the identifier of a document, Codex shows it. NEXT_PUBLIC_CODEX_URL unset: the
// reference is shown as text.
export function codexHref(ref: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_CODEX_URL;
  return ref && base ? `${base.replace(/\/+$/, '')}/documents/${encodeURIComponent(ref)}` : null;
}

/** Deep link to a Keystone project. */
export function keystoneProjectHref(code: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_KEYSTONE_URL;
  return code && base ? `${base.replace(/\/+$/, '')}/projects/${encodeURIComponent(code)}` : null;
}
