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

The app can run locally using browser storage while you connect Supabase. For production, create real users in Supabase Auth and matching rows in the `profiles` table.

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


## Login fix in v5

This version persists the active session in browser storage and also checks the Supabase Auth session on page load. Before this, login could succeed and then fail after redirect because React state was lost when `/account`, `/staff`, or `/owner` loaded.

For staff and owner access, create a user in Supabase Auth and a matching profile row with the same email and the correct role:

```sql
insert into profiles (id, role, full_name, email, phone, member_id, pin_code)
values ('PASTE_AUTH_USER_ID', 'staff', 'Afghan Kabob Staff', 'staff@afghankabob.ca', '', 'STAFF-001', null);

insert into profiles (id, role, full_name, email, phone, member_id, pin_code)
values ('PASTE_AUTH_USER_ID', 'owner', 'Afghan Kabob Owner', 'owner@afghankabob.ca', '', 'OWNER-001', null);
```

If you want PIN-only login for early testing, set `pin_code` on those profiles and use that value as the password/PIN.

## v7 staff/owner changes

- Staff redemption dropdown now uses the meals the customer selected in their latest meal-pass order, instead of showing the entire eligible menu.
- Customer pass details are shown as readable profile rows instead of small stat cards.
- Staff can edit menu listings only after entering a manager code. Default local/demo manager code is `4321`.
- Owner can edit menu listings and offer settings without the staff manager code.
- Every menu/offer edit is added to `audit_logs` and shown in Owner → Change log.

Run the added SQL in `supabase/schema.sql` to create the `audit_logs` table and policies.
