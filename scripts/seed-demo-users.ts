import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(url, serviceKey);

async function upsertAuthUser(email: string, password: string) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (error && !error.message.includes("already registered")) throw error;
  return data.user;
}

async function main() {
  await upsertAuthUser("kumail@example.com", "demo123");
  await upsertAuthUser("staff@afghankabob.ca", "staff123");
  await upsertAuthUser("owner@afghankabob.ca", "owner123");
  console.log("Demo auth users created. Now run supabase/schema.sql if you have not already.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
