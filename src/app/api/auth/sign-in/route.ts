import type { NextRequest } from 'next/server';
import { handleSignIn } from '@/server/auth/routes';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  return handleSignIn(req);
}
