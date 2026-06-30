import { NextResponse } from "next/server";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { baseEmail } from "@/lib/emailTemplates";

export async function POST(req: Request) {
  try {
    const { to, subject, body } = await req.json();
    const html = baseEmail({ title: subject, preview: body, body: `<p>${String(body).replace(/\n/g, "<br>")}</p>` });

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
      return NextResponse.json({ ok: true, provider: "gmail", result });
    }

    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const result = await resend.emails.send({
        from: process.env.FROM_EMAIL || "Afghan Kabob Rewards <rewards@afghankabob.ca>",
        to,
        subject,
        html
      });
      return NextResponse.json({ ok: true, provider: "resend", result });
    }

    return NextResponse.json({ ok: true, mode: "demo" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
