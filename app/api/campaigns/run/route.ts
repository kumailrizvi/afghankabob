import { NextResponse } from "next/server";

export async function POST() {
  // In production this endpoint is called by Vercel Cron every morning.
  // It should query Supabase for birthday / anniversary / win-back customers,
  // create message rows, and send emails through Resend.
  return NextResponse.json({ ok: true, message: "Campaign runner placeholder ready for Vercel Cron." });
}
