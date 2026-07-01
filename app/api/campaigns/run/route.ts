import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { baseEmail } from "@/lib/emailTemplates";

export const runtime = "nodejs";

type CampaignCustomer = {
  id: string;
  full_name: string | null;
  email: string | null;
  date_of_birth: string | null;
  anniversary: string | null;
};

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function monthDay(value?: string | null) {
  if (!value) return null;
  const parts = value.split("-");
  if (parts.length < 3) return null;
  return `${parts[1]}-${parts[2]}`;
}

function firstName(name?: string | null) {
  return (name || "there").trim().split(" ")[0] || "there";
}

async function sendEmail(to: string, subject: string, html: string) {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (gmailUser && gmailPass) {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass }
    });

    const result = await transporter.sendMail({
      from: process.env.FROM_EMAIL || gmailUser,
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

async function runCampaigns() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json(
      { ok: false, error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }

  const supabase = createClient(url, serviceKey);
  const today = new Date();
  const target = addDays(today, 7);
  const targetMonthDay = monthDay(target.toISOString().slice(0, 10));
  const campaignYear = String(today.getFullYear());

  const { data: customers, error: customerError } = await supabase
    .from("profiles")
    .select("id, full_name, email, date_of_birth, anniversary")
    .eq("role", "customer")
    .not("email", "is", null);

  if (customerError) {
    return NextResponse.json({ ok: false, error: customerError.message }, { status: 500 });
  }

  const results: Array<Record<string, unknown>> = [];

  async function maybeSend(customer: CampaignCustomer, type: "birthday" | "anniversary") {
    const dateValue = type === "birthday" ? customer.date_of_birth : customer.anniversary;
    if (!customer.email || monthDay(dateValue) !== targetMonthDay) return;

    const messageType = `${type}_7_day_${campaignYear}`;

    const { data: existing } = await supabase
      .from("messages")
      .select("id")
      .eq("customer_id", customer.id)
      .eq("message_type", messageType)
      .maybeSingle();

    if (existing?.id) {
      results.push({ customer: customer.email, type, skipped: "already_sent" });
      return;
    }

    const discount = 10;
    const subject = type === "birthday"
      ? "Your Afghan Kabob birthday offer is coming up"
      : "Your Afghan Kabob anniversary offer is coming up";

    const body = type === "birthday"
      ? `Hi ${firstName(customer.full_name)}, your birthday is coming up. Enjoy ${discount}% off at Afghan Kabob during your birthday week.`
      : `Hi ${firstName(customer.full_name)}, your anniversary is coming up. Enjoy ${discount}% off at Afghan Kabob during your anniversary week.`;

    const html = baseEmail({
      title: type === "birthday" ? "Happy early birthday!" : "Happy early anniversary!",
      preview: body,
      body: `<p>${body}</p><p>Show this email in-store to redeem.</p>`
    });

    let status: "sent" | "queued" | "failed" = "queued";
    let providerMessageId = "";
    let errorMessage = "";

    try {
      const sent = await sendEmail(customer.email, subject, html);
      status = sent.provider === "outbox" ? "queued" : "sent";
      providerMessageId = sent.id;
    } catch (error) {
      status = "failed";
      errorMessage = error instanceof Error ? error.message : "Unknown email error";
    }

    const { error: messageError } = await supabase.from("messages").insert({
      customer_id: customer.id,
      channel: "email",
      message_type: messageType,
      subject,
      body,
      status,
      provider_message_id: providerMessageId || null,
      sent_at: status === "sent" ? new Date().toISOString() : null
    });

    results.push({
      customer: customer.email,
      type,
      status,
      message_saved: !messageError,
      error: errorMessage || messageError?.message || null
    });
  }

  for (const customer of (customers || []) as CampaignCustomer[]) {
    await maybeSend(customer, "birthday");
    await maybeSend(customer, "anniversary");
  }

  return NextResponse.json({
    ok: true,
    target_date: target.toISOString().slice(0, 10),
    target_month_day: targetMonthDay,
    checked_customers: customers?.length || 0,
    sent_or_skipped: results
  });
}

export async function GET() {
  return runCampaigns();
}

export async function POST() {
  return runCampaigns();
}
