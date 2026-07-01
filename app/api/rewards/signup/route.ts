import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { baseEmail } from "@/lib/emailTemplates";

export const runtime = "nodejs";

type SignupBody = {
  full_name?: string;
  email?: string;
  phone?: string;
  pin_code?: string;
  date_of_birth?: string;
  anniversary?: string;
  member_id?: string;
};

function cleanEmail(email?: string) {
  return String(email || "").trim().toLowerCase();
}

function firstName(name?: string | null) {
  return (name || "there").trim().split(" ")[0] || "there";
}

async function sendEmail(to: string, subject: string, html: string) {
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
    });
    const result = await transporter.sendMail({
      from: process.env.FROM_EMAIL || process.env.GMAIL_USER,
      to,
      subject,
      html
    });
    return { provider: "gmail", id: String(result.messageId || "") };
  }

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: process.env.FROM_EMAIL || "Afghan Kabob Rewards <onboarding@resend.dev>",
      to,
      subject,
      html
    });
    return { provider: "resend", id: String(result.data?.id || "") };
  }

  return { provider: "outbox", id: "" };
}

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return NextResponse.json({ ok: false, error: "Missing Supabase server env vars." }, { status: 500 });
    }

    const body = (await req.json()) as SignupBody;
    const email = cleanEmail(body.email);
    const pin = String(body.pin_code || "").trim();
    const fullName = String(body.full_name || "").trim();

    if (!fullName || !email || !pin || !body.phone || !body.date_of_birth || !body.member_id) {
      return NextResponse.json({ ok: false, error: "Missing required rewards signup fields." }, { status: 400 });
    }

    const supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: existingProfile, error: existingProfileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (existingProfileError) {
      return NextResponse.json({ ok: false, error: existingProfileError.message }, { status: 500 });
    }

    if (existingProfile?.id) {
      return NextResponse.json({ ok: true, profile: existingProfile, already_exists: true });
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });

    if (authError || !authData.user?.id) {
      return NextResponse.json({ ok: false, error: authError?.message || "Could not create auth user." }, { status: 500 });
    }

    const profile = {
      id: authData.user.id,
      role: "customer",
      full_name: fullName,
      email,
      phone: String(body.phone),
      date_of_birth: body.date_of_birth || null,
      anniversary: body.anniversary || null,
      member_id: body.member_id,
      pin_code: pin
    };

    const { data: savedProfile, error: profileError } = await supabase
      .from("profiles")
      .insert(profile)
      .select("*")
      .single();

    if (profileError) {
      // Avoid leaving orphaned auth users during failed inserts.
      await supabase.auth.admin.deleteUser(authData.user.id).catch?.(() => undefined);
      return NextResponse.json({ ok: false, error: profileError.message }, { status: 500 });
    }

    const subject = "Welcome to Afghan Kabob Rewards";
    const textBody = `Hi ${firstName(fullName)}, your Afghan Kabob Rewards profile is active. Your member ID is ${body.member_id}.`;
    const html = baseEmail({
      title: "Welcome to Afghan Kabob Rewards",
      preview: textBody,
      body: `<p>${textBody}</p><p>Use your member ID in-store for rewards and offers.</p>`
    });

    let status: "sent" | "queued" | "failed" = "queued";
    let providerMessageId = "";
    let sendError = "";

    try {
      const sent = await sendEmail(email, subject, html);
      status = sent.provider === "outbox" ? "queued" : "sent";
      providerMessageId = sent.id;
    } catch (error) {
      status = "failed";
      sendError = error instanceof Error ? error.message : "Unknown email error";
    }

    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert({
        customer_id: savedProfile.id,
        channel: "email",
        message_type: "welcome",
        subject,
        body: textBody,
        status,
        provider_message_id: providerMessageId || null,
        sent_at: status === "sent" ? new Date().toISOString() : null
      })
      .select("*")
      .single();

    return NextResponse.json({
      ok: true,
      profile: savedProfile,
      message: message || null,
      email_status: status,
      email_error: sendError || messageError?.message || null
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown signup error" }, { status: 500 });
  }
}
