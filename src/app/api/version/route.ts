import { NextResponse } from 'next/server';
import { applicationVersion } from '../../../server/version';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(applicationVersion(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
