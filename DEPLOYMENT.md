# Afghan Kabob Rewards — Supabase + Vercel Deployment

This guide takes the app from local demo mode to a hosted production-style setup.

## 1) Local setup

```bash
cd afghan-kabob-rewards-next
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000/meal-pass`.

## 2) Supabase setup

1. Create a new Supabase project.
2. Go to **SQL Editor**.
3. Open `supabase/schema.sql` from this repo.
4. Paste the full SQL and run it.
5. Go to **Project Settings → API** and copy:
   - Project URL
   - anon public key
   - service role key

Put these in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_public_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Do not commit `.env.local`.

## 3) Resend email setup

1. Create a Resend account.
2. Verify `afghankabob.ca` or use a test sender while developing.
3. Create an API key.
4. Add this to `.env.local`:

```env
RESEND_API_KEY=your_resend_api_key
FROM_EMAIL=Afghan Kabob Rewards <rewards@afghankabob.ca>
```

The app has email routes at:

```txt
/api/email/send
/api/email/resend-message
```

## 4) Vercel deployment

1. Push the repo to GitHub.
2. Go to Vercel and import the repo.
3. Add the same environment variables in Vercel Project Settings → Environment Variables.
4. Deploy.
5. After deploy, set:

```env
NEXT_PUBLIC_APP_URL=https://your-vercel-url.vercel.app
```

Later, when the custom domain is ready:

```env
NEXT_PUBLIC_APP_URL=https://rewards.afghankabob.ca
```

## 5) Vercel cron

`vercel.json` already includes a daily cron:

```json
{
  "crons": [
    {
      "path": "/api/campaigns/run",
      "schedule": "0 15 * * *"
    }
  ]
}
```

This is meant for daily birthday, anniversary, and win-back checks.

## 6) Custom domain options

Recommended first launch:

```txt
rewards.afghankabob.ca
```

Then link to it from Afghan Kabob's main site navigation/buttons.

Possible public routes:

```txt
/rewards
/meal-pass
/login
/account
```

Private team routes:

```txt
/team-login
/staff
/owner
```

## 7) Production checklist

Before real customers use it:

- Turn on real Supabase writes for all customer/staff/owner actions.
- Add role-based route protection for staff and owner pages.
- Configure Resend verified domain.
- Add Stripe Checkout for online meal pass payments.
- Add Twilio only if SMS is needed.
- Add unsubscribe handling for marketing emails/SMS.
- Confirm CASL consent wording for Canadian email/SMS marketing.
