# Afghan Kabob Rewards — Real Build Starter

This is the Next.js version of Afghan Kabob Rewards. It is built for:

- Customer rewards signup
- Meal Pass checkout
- Customer QR pass
- Staff check-in and meal redemption
- Owner customer table, activity log, and email/SMS outbox
- Responsive email sending through Resend
- Supabase database/auth readiness
- Vercel deployment

## 1. Run locally

```bash
npm install
npm run dev
```

Open:

```txt
http://localhost:3000/meal-pass
```

The app works in demo/local mode immediately using browser storage.

Demo logins:

```txt
Customer: kumail@example.com / demo123
Staff: staff@afghankabob.ca / staff123
Owner: owner@afghankabob.ca / owner123
```

## 2. Pages

Public/customer:

```txt
/meal-pass
/rewards
/login
/account
```

Team:

```txt
/team-login
/staff
/owner
```

## 3. Supabase setup

Create a Supabase project, then run:

```txt
supabase/schema.sql
```

Add these to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
FROM_EMAIL=Afghan Kabob Rewards <rewards@afghankabob.ca>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 4. Email setup

The app has a real email API route:

```txt
/api/email/send
```

If `RESEND_API_KEY` is missing, emails are only recorded in the demo outbox.
If it is present, the route sends responsive HTML emails through Resend.

## 5. Deploy to Vercel

```bash
git init
git add .
git commit -m "Initial Afghan Kabob Rewards build"
git branch -M main
git remote add origin YOUR_REPO_URL
git push -u origin main
```

Then import the repo into Vercel and add the same environment variables.

## 6. Next production steps

- Replace local demo storage with full Supabase reads/writes for every page.
- Add Stripe Checkout for online Meal Pass payments.
- Add Twilio for SMS.
- Add Vercel Cron for daily birthday/anniversary/win-back campaigns.
- Add role-based route protection for `/staff` and `/owner`.


## Deployment

Use `DEPLOYMENT.md` for the Supabase, Resend, and Vercel setup. The app also includes `/api/health` so you can confirm environment variables are present after deploy.
