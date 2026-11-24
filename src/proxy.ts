// Proxy (Next 16's middleware). Demo mode (VECTOR_AUTH=demo, the default): does nothing — the "View as" cookie stays the
// session. Entra mode (sign-in through Clavis): every request needs a valid session cookie, except the sign-in page, the health probe and static
// assets. Without one, a page load is redirected to the sign-in page (back to the same page afterwards); an API call, a
// Server Function POST or a script request (Sec-Fetch-Dest: empty — client-side navigations and prefetches) gets 401: the
// router then reloads the page, which redirects. This is the optimistic check (cookie only, no database): getViewer()
// re-checks the account on the server for every page, Route Handler and Server Function. Every request the proxy lets
// through carries a per-request Content-Security-Policy with a nonce (src/server/http/proxy-security.ts).
import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_PATHS, isPublicPath } from '@/domain/auth';
import { authMode, sessionConfig } from '@/server/auth/config';
import { readSession } from '@/server/auth/session-cookie';
import { nextWithCsp } from '@/server/http/proxy-security';

const unauthorized = () => new NextResponse('Sign-in required', { status: 401, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' } });

export async function proxy(request: NextRequest): Promise<NextResponse> {
  let mode;
  try {
    mode = authMode();
  } catch (e) {
    // VECTOR_AUTH has an unknown value: refuse everything rather than run unauthenticated.
    console.error('[auth]', e instanceof Error ? e.message : e);
    return new NextResponse('Authentication is misconfigured', { status: 500 });
  }
  if (mode !== 'entra') return nextWithCsp(request);
  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) return nextWithCsp(request);
  let ok = false;
  try {
    const cfg = sessionConfig();
    ok = !!(await readSession(cfg, request.cookies.get(cfg.cookieName)?.value));
  } catch (e) {
    console.error('[auth]', e instanceof Error ? e.message : e);
    const page = request.method === 'GET' && !pathname.startsWith('/api/');
    return page ? NextResponse.redirect(new URL(`${AUTH_PATHS.page}?error=config`, request.url)) : unauthorized();
  }
  if (ok) return nextWithCsp(request);
  const script = request.headers.get('sec-fetch-dest') === 'empty';
  if (pathname.startsWith('/api/') || script || (request.method !== 'GET' && request.method !== 'HEAD')) return unauthorized();
  const target = new URL(AUTH_PATHS.page, request.url);
  target.searchParams.set('returnTo', pathname + search);
  return NextResponse.redirect(target);
}

export const config = {
  // Next's build output and image optimiser never need a session; everything else goes through the checks above.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
