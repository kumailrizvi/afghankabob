export function baseEmail({ title, preview, body }: { title: string; preview: string; body: string }) {
  return `
  <!doctype html>
  <html>
  <head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="margin:0;background:#f7f3ed;font-family:Arial,sans-serif;color:#1f1b18;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preview}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f3ed;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e7dacb;">
          <tr><td style="background:#10583f;color:#fff;padding:20px 24px;font-size:22px;font-weight:800;">Afghan Kabob Rewards</td></tr>
          <tr><td style="padding:28px 24px;">
            <h1 style="margin:0 0 14px;font-size:28px;line-height:1.15;color:#1f1b18;">${title}</h1>
            <div style="font-size:16px;line-height:1.6;color:#433b34;">${body}</div>
          </td></tr>
          <tr><td style="padding:18px 24px;color:#766d65;font-size:12px;border-top:1px solid #eee6dc;">Afghan Kabob & Donair • You can unsubscribe from promotional messages anytime.</td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

export function welcomeEmail(name: string) {
  return baseEmail({
    title: `Welcome to Afghan Kabob Rewards, ${name.split(" ")[0] || name}`,
    preview: "Your rewards profile has been created.",
    body: `<p>Your rewards profile is active. You can now receive birthday, anniversary, and special offers.</p><p>Show your phone number or member ID in-store to redeem eligible offers.</p>`
  });
}

export function mealRedeemedEmail(name: string, item: string, remaining: number) {
  return baseEmail({
    title: "Your meal pass was used",
    preview: `${item} redeemed. ${remaining} meals remaining.`,
    body: `<p>Hi ${name.split(" ")[0] || name},</p><p>Your meal pass was used for <strong>${item}</strong>.</p><p>You have <strong>${remaining}</strong> meals remaining.</p>`
  });
}
