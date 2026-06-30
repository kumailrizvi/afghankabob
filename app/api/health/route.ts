import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: "Afghan Kabob Rewards",
    supabaseUrlSet: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKeySet: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceKeySet: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    resendSet: Boolean(process.env.RESEND_API_KEY),
    fromEmailSet: Boolean(process.env.FROM_EMAIL),
    appUrl: process.env.NEXT_PUBLIC_APP_URL || null,
  });
}
