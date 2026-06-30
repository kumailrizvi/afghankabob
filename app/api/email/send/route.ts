import { NextResponse } from "next/server";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { baseEmail } from "@/lib/emailTemplates";

async function sendWithGmail(to: string, subject: string, html: string) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass }
  });

  return transporter.sendMail({
    from: process.env.FROM_EMAIL || user,
    to,
    subject,
    html
  });
}

async function sendWithResend(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) return null;
  const resend = new Resend(process.env.RESEND_API_KEY);
  return resend.emails.send({
    from: process.env.FROM_EMAIL || "Afghan Kabob Rewards <rewards@afghankabob.ca>",
    to,
    subject,
    html
  });
}

export async function POST(req: Request) {
  try {
    const { to, subject, body } = await req.json();
    if (!to || !subject || !body) return NextResponse.json({ error: "Missing to, subject, or body" }, { status: 400 });

    const html = baseEmail({ title: subject, preview: body, body: `<p>${String(body).replace(/\n/g, "<br>")}</p>` });

    const gmailResult = await sendWithGmail(to, subject, html);
    if (gmailResult) return NextResponse.json({ ok: true, provider: "gmail", result: gmailResult });

    const resendResult = await sendWithResend(to, subject, html);
    if (resendResult) return NextResponse.json({ ok: true, provider: "resend", result: resendResult });

    return NextResponse.json({ ok: true, mode: "demo", message: "No email provider configured. Email recorded but not sent." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
