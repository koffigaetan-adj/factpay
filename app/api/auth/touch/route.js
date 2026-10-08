import { NextResponse } from 'next/server';
import { touchSession } from '@/lib/auth';

export async function POST() {
  const ok = await touchSession();
  if (!ok) {
    return NextResponse.json({ ok: false, error: 'Session expirée' }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return POST();
}
