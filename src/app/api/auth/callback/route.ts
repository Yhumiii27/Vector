import type { NextRequest } from 'next/server';
import { handleCallback } from '@/server/auth/routes';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  return handleCallback(req);
}
