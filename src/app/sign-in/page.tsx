// Sign-in page — public, outside the app shell. Entra mode: one button "Sign in with Clavis" (OpenID Connect, the group's
// central sign-in). Demo mode: there is nothing to sign in to, so it goes Home.
import { CheckCircle, SignIn, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardTitle } from '@norma/charte/ds/Card';
import { cx } from '@norma/charte/ds/cx';
import { AUTH_PATHS, SIGN_IN_ERROR, isSignInError, safeReturnTo } from '@/domain/auth';
import s from '@/features/auth/sign-in.module.css';
import { authMode } from '@/server/auth/config';
import { getI18n } from '@/server/session';
import { ToolLogo } from '@norma/charte/ds/ToolLogo';

export const metadata: Metadata = { title: 'Vector' };

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SignInPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  if (authMode() !== 'entra') redirect('/');
  const error = first(sp.error);
  const signedOut = first(sp.signedOut) === '1';
  const { t } = await getI18n();
  const message = error ? SIGN_IN_ERROR[isSignInError(error) ? error : 'failed'] : null;
  const href = `${AUTH_PATHS.signIn}?returnTo=${encodeURIComponent(safeReturnTo(first(sp.returnTo)))}`;
  return (
    <main className={s.page}>
      <Card elev="lg" className={s.card}>
        <div className={s.brand}>
          <ToolLogo code="vector" />
          <div className={s.wordmark}>Vector</div>
        </div>
        <CardTitle as="span">{t('Sign in to Vector')}</CardTitle>
        <p className={s.lead}>{t('Vector uses the group sign-in (Clavis). Your rights are those IT grants you in Clavis.')}</p>
        {message && (
          <p className={cx(s.notice, s.alert)} role="alert">
            <WarningCircle size={16} className={s.noticeIcon} aria-hidden />
            {t(message)}
          </p>
        )}
        {!message && signedOut && (
          <p className={s.notice} role="status">
            <CheckCircle size={16} className={s.noticeIcon} aria-hidden />
            {t('You are signed out.')}
          </p>
        )}
        <a className="btn btn-primary" href={href}>
          <SignIn size={14} aria-hidden /> {t('Sign in with Clavis')}
        </a>
      </Card>
    </main>
  );
}
