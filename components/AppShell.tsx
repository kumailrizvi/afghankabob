"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { mealPlans as defaultMealPlans, menuItems, type MealPlan } from "@/lib/plans";
import { memberId, qrUrl } from "@/lib/qr";
import { isSupabaseConfigured, supabaseBrowser } from "@/lib/supabase";
import type { MealPass, Message, Order, Profile, Redemption, Role } from "@/lib/types";

type View = "meal-pass" | "rewards" | "login" | "team-login" | "account" | "staff" | "staff-menu" | "owner";
type MenuItem = { name: string; category: string; price: number; image_url?: string; description?: string };
type OrderItem = MenuItem & { quantity: number };

type Store = {
  profiles: Profile[];
  passes: MealPass[];
  orders: Order[];
  orderItems: Record<string, OrderItem[]>;
  redemptions: Redemption[];
  messages: Message[];
  menuItems: MenuItem[];
  mealPlans: MealPlan[];
  birthdayDiscount: number;
  anniversaryDiscount: number;
  managerEditCode: string;
  auditLogs: { id: string; actor_id?: string | null; actor_name: string; action: string; entity_type: string; entity_name: string; before_value?: string | null; after_value?: string | null; created_at: string; }[];
  passwords: Record<string, string>;
};

const nowIso = () => new Date().toISOString();
const money = (n: number) => `$${n.toFixed(2)}`;
const STORAGE = "akr-next-store-v3";
const SESSION = "akr-active-session-v1";

type ActiveSession = { id: string; role: Role; email?: string | null };

const demoCustomerId = "demo-customer-1";
const demoStaffId = "demo-staff-1";
const demoOwnerId = "demo-owner-1";

function readImageFile(file: File, onDone: (dataUrl: string) => void) {
  const reader = new FileReader();
  reader.onload = () => onDone(String(reader.result || ""));
  reader.readAsDataURL(file);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

function formatCanadianPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^1/, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function normalizePhoneForSave(value: string) {
  return formatCanadianPhoneInput(value);
}

function initialStore(): Store {
  const passId = "demo-pass-1";
  const orderId = "demo-order-1";
  return {
    profiles: [
      { id: demoCustomerId, role: "customer", full_name: "Kumail Rizvi", email: "kumail@example.com", phone: "3065557788", date_of_birth: "1998-07-10", anniversary: "2026-12-05", member_id: "AKR-AA4QN", pin_code: "1234", created_at: nowIso() },
      { id: "demo-customer-2", role: "customer", full_name: "Sara Ahmed", email: "sara@example.com", phone: "3065551122", date_of_birth: "1996-08-14", anniversary: "2026-10-01", member_id: "AKR-XZXVM", pin_code: "2222", created_at: nowIso() },
      { id: demoStaffId, role: "staff", full_name: "Staff User", email: "staff@afghankabob.ca", phone: "", member_id: null, created_at: nowIso() },
      { id: demoOwnerId, role: "owner", full_name: "Owner User", email: "owner@afghankabob.ca", phone: "", member_id: null, created_at: nowIso() }
    ],
    passwords: {
      "kumail@example.com": "demo123",
      "staff@afghankabob.ca": "staff123",
      "owner@afghankabob.ca": "owner123"
    },
    passes: [
      { id: passId, customer_id: demoCustomerId, frequency: "monthly", tier: "Monthly Classic", meals_included: 8, meals_used: 1, price: 109.99, status: "active", start_date: "2026-06-30", renewal_date: "2026-07-30" },
      { id: "demo-pass-2", customer_id: "demo-customer-2", frequency: "weekly", tier: "Weekly Value", meals_included: 3, meals_used: 1, price: 39.99, status: "active", start_date: "2026-06-30", renewal_date: "2026-07-07" }
    ],
    orders: [
      { id: orderId, customer_id: demoCustomerId, meal_pass_id: passId, order_type: "online", subtotal: 109.99, tax: 14.30, total: 124.29, payment_status: "paid", created_at: nowIso() }
    ],
    orderItems: {
      [orderId]: [
        { name: "Afghan Chicken Kabob", category: "Kabob", price: 22, quantity: 3 },
        { name: "12” Jumbo Donair", category: "Donair", price: 14, quantity: 3 },
        { name: "Donair Plate", category: "Donair", price: 18, quantity: 2 }
      ]
    },
    redemptions: [
      { id: "red-1", customer_id: demoCustomerId, meal_pass_id: passId, staff_id: demoStaffId, item_name: "Afghan Chicken Kabob", category: "Kabob", meals_remaining: 7, created_at: nowIso() }
    ],
    messages: [
      { id: "msg-1", customer_id: demoCustomerId, channel: "email", message_type: "welcome", subject: "Welcome to Afghan Kabob Rewards", body: "Your rewards profile is active.", status: "sent", sent_at: nowIso(), created_at: nowIso() },
      { id: "msg-2", customer_id: demoCustomerId, channel: "email", message_type: "meal_redeemed", subject: "Your meal pass was used", body: "Afghan Chicken Kabob redeemed. 7 meals remaining.", status: "sent", sent_at: nowIso(), created_at: nowIso() }
    ],
    menuItems: menuItems.map((item) => ({ description: `${item.name} served Afghan Kabob style with fresh sides and sauces.`, ...item })),
    mealPlans: defaultMealPlans.map((plan) => ({ ...plan })),
    birthdayDiscount: 10,
    anniversaryDiscount: 10,
    managerEditCode: "4321",
    auditLogs: []
  };
}

function daysToRenewal(freq: string) {
  const d = new Date();
  if (freq === "daily") d.setDate(d.getDate() + 1);
  else if (freq === "weekly") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export function AppShell({ view }: { view: View }) {
  const router = useRouter();
  const [store, setStore] = useState<Store>(initialStore());
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      const rawStore = localStorage.getItem(STORAGE);
      if (rawStore) {
        try {
          setStore((() => { const parsed = JSON.parse(rawStore); return { ...parsed, menuItems: parsed.menuItems || menuItems.map((item) => ({ description: `${item.name} served Afghan Kabob style with fresh sides and sauces.`, ...item })), mealPlans: parsed.mealPlans || defaultMealPlans.map((plan) => ({ ...plan })), birthdayDiscount: parsed.birthdayDiscount ?? 10, anniversaryDiscount: parsed.anniversaryDiscount ?? 10, managerEditCode: parsed.managerEditCode || "4321", auditLogs: parsed.auditLogs || [] }; })());
        } catch {
          localStorage.removeItem(STORAGE);
        }
      }

      const rawSession = localStorage.getItem(SESSION);
      if (rawSession) {
        try {
          const session = JSON.parse(rawSession) as ActiveSession;
          setActiveRole(session.role);
          setActiveUserId(session.id);
        } catch {
          localStorage.removeItem(SESSION);
        }
      }

      if (isSupabaseConfigured) {
        const supabase = supabaseBrowser();
        const { data: authData } = await supabase!.auth.getUser();
        const authEmail = authData.user?.email?.toLowerCase();
        if (authEmail) {
          const { data: profile } = await supabase!
            .from("profiles")
            .select("*")
            .eq("email", authEmail)
            .maybeSingle();
          if (profile && mounted) {
            const typed = profile as Profile;
            setStore((current) => ({
              ...current,
              profiles: current.profiles.some((p) => p.id === typed.id)
                ? current.profiles.map((p) => p.id === typed.id ? typed : p)
                : [typed, ...current.profiles]
            }));
            setActiveRole(typed.role);
            setActiveUserId(typed.id);
            localStorage.setItem(SESSION, JSON.stringify({ id: typed.id, role: typed.role, email: typed.email }));
          }
        }
      }

      if (mounted) setAuthReady(true);
    }

    boot();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE, JSON.stringify(store));
  }, [store]);

  const activeProfile = store.profiles.find((p) => p.id === activeUserId) || null;

  function persistSession(profile: Profile) {
    setActiveRole(profile.role);
    setActiveUserId(profile.id);
    localStorage.setItem(SESSION, JSON.stringify({ id: profile.id, role: profile.role, email: profile.email }));
  }

  async function refreshStoreFromSupabase() {
    if (!isSupabaseConfigured) return;
    const supabase = supabaseBrowser();
    const [profiles, passes, orders, orderItems, redemptions, messages, remoteMenuItems, remoteMealPlans, auditLogs] = await Promise.all([
      supabase!.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase!.from("meal_passes").select("*").order("created_at", { ascending: false }),
      supabase!.from("orders").select("*").order("created_at", { ascending: false }),
      supabase!.from("order_items").select("*"),
      supabase!.from("redemptions").select("*").order("created_at", { ascending: false }),
      supabase!.from("messages").select("*").order("created_at", { ascending: false }),
      supabase!.from("menu_items").select("*").eq("active", true).order("name", { ascending: true }),
      supabase!.from("meal_plan_settings").select("*").order("frequency", { ascending: true }),
      supabase!.from("audit_logs").select("*").order("created_at", { ascending: false })
    ]);
    if (profiles.error || passes.error || orders.error || orderItems.error || redemptions.error || messages.error) return;
    const groupedItems: Record<string, OrderItem[]> = {};
    (orderItems.data || []).forEach((item: any) => {
      const orderId = String(item.order_id);
      groupedItems[orderId] = groupedItems[orderId] || [];
      groupedItems[orderId].push({ name: item.item_name, category: item.category, price: Number(item.price), quantity: Number(item.quantity || 1) });
    });
    setStore((current) => ({
      ...current,
      profiles: (profiles.data || []) as Profile[],
      passes: (passes.data || []).map((p: any) => ({ ...p, price: Number(p.price) })) as MealPass[],
      orders: (orders.data || []).map((o: any) => ({ ...o, subtotal: Number(o.subtotal), tax: Number(o.tax), total: Number(o.total) })) as Order[],
      orderItems: groupedItems,
      redemptions: (redemptions.data || []) as Redemption[],
      messages: (messages.data || []) as Message[],
      menuItems: remoteMenuItems.error || !remoteMenuItems.data?.length
        ? (current.menuItems || menuItems.map((item) => ({ description: `${item.name} served Afghan Kabob style with fresh sides and sauces.`, ...item })))
        : remoteMenuItems.data.map((item: any) => ({ name: item.name, category: item.category, price: Number(item.price), image_url: item.image_url || "", description: item.description || `${item.name} served Afghan Kabob style with fresh sides and sauces.` })),
      mealPlans: remoteMealPlans.error || !remoteMealPlans.data?.length
        ? (current.mealPlans || defaultMealPlans.map((plan) => ({ ...plan })))
        : remoteMealPlans.data.map((plan: any) => ({ id: plan.id, frequency: plan.frequency, tier: plan.tier, meals: Number(plan.meals), price: Number(plan.price), compareAt: plan.compare_at ? Number(plan.compare_at) : undefined, categories: plan.categories || [], description: plan.description || "" })),
      auditLogs: auditLogs.error ? (current.auditLogs || []) : ((auditLogs.data || []) as Store["auditLogs"]),
      birthdayDiscount: current.birthdayDiscount ?? 10,
      anniversaryDiscount: current.anniversaryDiscount ?? 10
    }));
  }

  async function login(email: string, password: string, role?: Role) {
    const clean = email.trim().toLowerCase();

    if (isSupabaseConfigured) {
      const supabase = supabaseBrowser();

      const auth = await supabase?.auth.signInWithPassword({ email: clean, password });
      if (!auth?.error) {
        const { data: profile, error: profileError } = await supabase!
          .from("profiles")
          .select("*")
          .eq("email", clean)
          .maybeSingle();

        if (profileError) {
          setNotice(`Login found your account, but profile lookup failed: ${profileError.message}`);
          return false;
        }

        if (profile && (!role || profile.role === role)) {
          const typed = profile as Profile;
          setStore((s) => ({
            ...s,
            profiles: s.profiles.some((p) => p.id === typed.id)
              ? s.profiles.map((p) => p.id === typed.id ? typed : p)
              : [typed, ...s.profiles]
          }));
          persistSession(typed);
          await refreshStoreFromSupabase();
          setNotice(`Logged in as ${typed.full_name}.`);
          return true;
        }

        setNotice(role ? `This account is not a ${role} account.` : "No profile row exists for this login.");
        return false;
      }

      // Customer fallback: allow email + PIN/password against profiles.pin_code.
      // This helps Rewards / Meal Pass users log in even if email confirmation is still enabled in Supabase Auth.
      const { data: profile } = await supabase!
        .from("profiles")
        .select("*")
        .eq("email", clean)
        .maybeSingle();
      if (profile && (!role || profile.role === role) && profile.pin_code && profile.pin_code === password) {
        const typed = profile as Profile;
        persistSession(typed);
        await refreshStoreFromSupabase();
        setNotice(`Logged in as ${typed.full_name}.`);
        return true;
      }

      setNotice(auth?.error?.message || "Login failed. Check email and password/PIN.");
      return false;
    }

    const profile = store.profiles.find((p) => p.email?.toLowerCase() === clean && (!role || p.role === role));
    if (!profile || store.passwords[clean] !== password) {
      setNotice("Login failed. Check email and password/PIN.");
      return false;
    }
    persistSession(profile);
    setNotice(`Logged in as ${profile.full_name}.`);
    return true;
  }

  async function logout() {
    if (isSupabaseConfigured) await supabaseBrowser()?.auth.signOut();
    setActiveRole(null);
    setActiveUserId(null);
    localStorage.removeItem(SESSION);
    setNotice("Logged out.");
    router.push("/login");
  }

  async function saveProfile(profile: Profile, password: string) {
    let savedProfile = profile;
    if (isSupabaseConfigured) {
      const supabase = supabaseBrowser();
      const auth = await supabase?.auth.signUp({ email: profile.email, password });
      if (auth?.data.user?.id) savedProfile = { ...profile, id: auth.data.user.id };
      await supabase?.from("profiles").upsert(savedProfile);
    }
    setStore((s) => ({ ...s, profiles: [savedProfile, ...s.profiles.filter((p) => p.id !== savedProfile.id)], passwords: { ...s.passwords, [savedProfile.email.toLowerCase()]: password } }));
    persistSession(savedProfile);
    return savedProfile;
  }

  async function addMessage(customerId: string, type: string, subject: string, body: string, channel: "email" | "sms" = "email") {
    const msg: Message = { id: crypto.randomUUID(), customer_id: customerId, channel, message_type: type, subject, body, status: "queued", created_at: nowIso() };
    setStore((s) => ({ ...s, messages: [msg, ...s.messages] }));
    if (isSupabaseConfigured) {
      await supabaseBrowser()?.from("messages").insert(msg);
    }
    const customer = store.profiles.find((p) => p.id === customerId);
    if (customer?.email && channel === "email") {
      try {
        const res = await fetch("/api/email/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: customer.email, subject, body }) });
        const updated: Pick<Message, "status" | "sent_at"> = { status: res.ok ? "sent" : "failed", sent_at: res.ok ? nowIso() : null };
        setStore((s) => ({ ...s, messages: s.messages.map((m) => m.id === msg.id ? { ...m, ...updated } : m) }));
        if (isSupabaseConfigured) await supabaseBrowser()?.from("messages").update(updated).eq("id", msg.id);
      } catch {
        setStore((s) => ({ ...s, messages: s.messages.map((m) => m.id === msg.id ? { ...m, status: "failed" } : m) }));
        if (isSupabaseConfigured) await supabaseBrowser()?.from("messages").update({ status: "failed" }).eq("id", msg.id);
      }
    }
  }



  async function addAuditLog(action: string, entityType: string, entityName: string, beforeValue: string | null, afterValue: string | null) {
    const actor = store.profiles.find((p) => p.id === activeUserId);
    const log = {
      id: crypto.randomUUID(),
      actor_id: actor?.id || null,
      actor_name: actor?.full_name || "System",
      action,
      entity_type: entityType,
      entity_name: entityName,
      before_value: beforeValue,
      after_value: afterValue,
      created_at: nowIso()
    };
    setStore((s) => ({ ...s, auditLogs: [log, ...(s.auditLogs || [])] }));
    if (isSupabaseConfigured) {
      await supabaseBrowser()?.from("audit_logs").insert(log);
    }
  }

  const needsCustomer = view === "account";
  const needsStaff = view === "staff" || view === "staff-menu";
  const needsOwner = view === "owner";
  const blocked = (needsCustomer && activeRole !== "customer") || (needsStaff && activeRole !== "staff") || (needsOwner && activeRole !== "owner");

  if (!authReady && (needsCustomer || needsStaff || needsOwner)) {
    return <main className="page-shell auth-shell"><div className="card p-8 text-center font-black text-kabob-green">Checking your session…</div></main>;
  }

  if (blocked) {
    const href = needsCustomer ? "/login" : "/team-login";
    return <main className="page-shell auth-shell"><div className="card p-8 md:p-10 text-center max-w-[560px]"><h1 className="text-4xl font-black">Login required</h1><p className="text-[#74675d] font-semibold mt-3">Please log in to access this page.</p><a className="btn-primary mt-6" href={href}>Go to login</a></div></main>;
  }

  return (
    <main className={view === "login" || view === "team-login" ? "page-shell auth-shell" : "page-shell"}>
      {notice && <div className="mb-6 rounded-2xl bg-kabob-cream border border-kabob-sand p-4 font-bold text-kabob-green">{notice}</div>}
      {view === "meal-pass" && <MealPass store={store} saveProfile={saveProfile} setStore={setStore} addMessage={addMessage} />}
      {view === "rewards" && <Rewards saveProfile={saveProfile} addMessage={addMessage} />}
      {view === "login" && <Login title="Customer login" role="customer" login={login} activeProfile={activeProfile} store={store} />}
      {view === "team-login" && <TeamLogin login={login} activeRole={activeRole} />}
      {view === "account" && <Account store={store} profile={activeProfile} />}
      {view === "staff" && <Staff store={store} setStore={setStore} addMessage={addMessage} addAuditLog={addAuditLog} logout={logout} />}
      {view === "staff-menu" && <StaffMenu store={store} setStore={setStore} addAuditLog={addAuditLog} logout={logout} />}
      {view === "owner" && <Owner store={store} setStore={setStore} addAuditLog={addAuditLog} logout={logout} />}
    </main>
  );
}

function MealPass({ store, saveProfile, setStore, addMessage }: { store: Store; saveProfile: (p: Profile, password: string) => Promise<Profile>; setStore: React.Dispatch<React.SetStateAction<Store>>; addMessage: (id: string, t: string, s: string, b: string) => Promise<void>; }) {
  const [frequency, setFrequency] = useState("weekly");
  const [planId, setPlanId] = useState("weekly-classic");
  const plans = store.mealPlans || defaultMealPlans;
  const plan = plans.find((p) => p.id === planId) || plans[0] || defaultMealPlans[0];
  const eligibleItems = store.menuItems.filter((item) => plan.categories.includes(item.category));
  const [items, setItems] = useState<OrderItem[]>([]);
  const [checkout, setCheckout] = useState(false);
  const [doneCustomer, setDoneCustomer] = useState<Profile | null>(null);

  useEffect(() => {
    const first = plans.find((p) => p.frequency === frequency);
    if (first) setPlanId(first.id);
    setItems([]);
  }, [frequency]);

  function addItem(item: MenuItem) {
    const total = items.reduce((a, i) => a + i.quantity, 0);
    if (total >= plan.meals) return;
    setItems((prev) => {
      const existing = prev.find((i) => i.name === item.name);
      if (existing) return prev.map((i) => i.name === item.name ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...item, quantity: 1 }];
    });
  }

  async function submit(form: FormData) {
    const customer: Profile = {
      id: crypto.randomUUID(), role: "customer", full_name: String(form.get("name")), email: String(form.get("email")), phone: normalizePhoneForSave(String(form.get("phone"))), date_of_birth: String(form.get("dob") || ""), anniversary: String(form.get("anniversary") || ""), member_id: memberId(), pin_code: String(form.get("pin") || ""), created_at: nowIso()
    };
    const savedCustomer = await saveProfile(customer, String(form.get("pin") || "1234"));
    const passId = crypto.randomUUID();
    const orderId = crypto.randomUUID();
    const pass: MealPass = { id: passId, customer_id: savedCustomer.id, frequency: plan.frequency, tier: plan.tier, meals_included: plan.meals, meals_used: 0, price: plan.price, status: "active", start_date: new Date().toISOString().slice(0, 10), renewal_date: daysToRenewal(plan.frequency) };
    const order: Order = { id: orderId, customer_id: savedCustomer.id, meal_pass_id: passId, order_type: String(form.get("payMode")) === "in_store" ? "in_store" : "online", subtotal: plan.price, tax: +(plan.price * 0.11).toFixed(2), total: +(plan.price * 1.11).toFixed(2), payment_status: String(form.get("payMode")) === "in_store" ? "pending_in_store" : "paid", paid_at: String(form.get("payMode")) === "in_store" ? null : nowIso(), created_at: nowIso() };
    const chosenItems = items.length ? items : eligibleItems.slice(0, plan.meals).map((i) => ({ ...i, quantity: 1 }));
    setStore((s) => ({ ...s, passes: [pass, ...s.passes], orders: [order, ...s.orders], orderItems: { ...s.orderItems, [orderId]: chosenItems } }));
    if (isSupabaseConfigured) {
      const supabase = supabaseBrowser();
      await supabase?.from("meal_passes").insert(pass);
      await supabase?.from("orders").insert(order);
      await supabase?.from("order_items").insert(chosenItems.map((i) => ({ order_id: orderId, item_name: i.name, category: i.category, price: i.price, quantity: i.quantity })));
    }
    await addMessage(savedCustomer.id, "meal_pass_created", "Your Afghan Kabob meal pass is ready", `Your ${plan.tier} pass is active. Member ID: ${savedCustomer.member_id}.`);
    setDoneCustomer(savedCustomer);
  }

  if (doneCustomer) return <PassCard customer={doneCustomer} store={store} />;

  if (checkout) {
    return (
      <section>
        <StepBar step={3} />
        <div className="grid lg:grid-cols-[1fr_380px] gap-10">
          <form action={submit} className="card p-8 md:p-10 space-y-6">
            <h1 className="text-5xl font-black">Checkout</h1>
            <div className="grid md:grid-cols-2 gap-5">
              <Field name="name" label="Full name" required />
              <Field name="email" label="Email" type="email" required />
              <PhoneField name="phone" label="Phone number" required />
              <Field name="pin" label="Password or 4-digit PIN" required />
              <Field name="dob" label="Date of birth" type="date" />
              <Field name="anniversary" label="Anniversary" type="date" />
            </div>
            <div className="card-soft p-5">
              <div className="font-black mb-3">Checkout method</div>
              <label className="mr-6 font-bold"><input name="payMode" type="radio" value="online" defaultChecked /> Pay online <span className="beta-pill">Stripe beta</span></label>
              <label className="font-bold"><input name="payMode" type="radio" value="in_store" /> Pay in-store</label>
            </div>
            <label className="flex gap-3 text-sm font-bold"><input required type="checkbox" /> I agree to receive transactional messages and optional rewards messages.</label>
            <div className="flex flex-wrap gap-3"><button className="btn-primary" type="submit">Submit order</button><button className="btn-secondary" type="button" onClick={() => setCheckout(false)}>Back</button></div>
          </form>
          <OrderSummary plan={plan} items={items} />
        </div>
      </section>
    );
  }

  return (
    <section>
      <StepBar step={items.reduce((a, i) => a + i.quantity, 0) ? 2 : 1} />
      <div className="mb-10"><h1 className="text-5xl md:text-6xl font-black">Meal Pass</h1><p className="text-[#74675d] font-semibold mt-4 max-w-2xl leading-7">Choose a daily, weekly, or monthly pass, then pick the meals included in your order.</p></div>
      <div className="flex gap-3 mb-7 flex-wrap">
        {["daily", "weekly", "monthly"].map((f) => <button key={f} onClick={() => setFrequency(f)} className={frequency === f ? "btn-primary" : "btn-secondary"}>{f[0].toUpperCase()+f.slice(1)}</button>)}
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
        {plans.filter((p) => p.frequency === frequency).map((p) => (
          <button key={p.id} onClick={() => setPlanId(p.id)} className={`card p-7 text-left plan-card ${planId === p.id ? "plan-card-selected" : ""}`}>
            <div className="flex items-start justify-between gap-3"><div className="text-2xl font-black">{p.tier}</div>{planId === p.id && <span className="selected-badge">Selected</span>}</div>
            <div className="text-lg font-extrabold text-kabob-green mt-2">{p.meals} meals / {p.frequency}</div>
            <div className="text-3xl font-black mt-4">{money(p.price)} <span className="text-base line-through text-[#9a9188]">{p.compareAt ? money(p.compareAt) : ""}</span></div>
            <p className="text-sm text-[#766d65] font-semibold mt-3 leading-6">{p.description}</p>
          </button>
        ))}
      </div>
      <div className="card p-7 mb-7"><h2 className="text-3xl font-black mb-1">Pick your meals</h2><p className="text-[#766d65] font-bold">Selected {items.reduce((a, i) => a + i.quantity, 0)} of {plan.meals}</p></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-28">
        {eligibleItems.map((item) => <MealItemCard key={item.name} item={item} selectedQuantity={items.find((i)=>i.name===item.name)?.quantity || 0} onAdd={() => addItem(item)} />)}
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 border-t border-kabob-sand p-4"><div className="mx-auto max-w-7xl flex justify-between items-center"><div className="font-black">{items.reduce((a, i) => a + i.quantity, 0)} meals selected</div><div className="flex items-center gap-4"><div className="text-2xl font-black text-kabob-green">{money(plan.price)}</div><button disabled={items.reduce((a, i) => a + i.quantity, 0) === 0} onClick={() => setCheckout(true)} className="btn-primary disabled:opacity-50">Continue</button></div></div></div>
    </section>
  );
}

function Rewards({ saveProfile, addMessage }: { saveProfile: (p: Profile, password: string) => Promise<Profile>; addMessage: (id: string, t: string, s: string, b: string) => Promise<void>; }) {
  const [created, setCreated] = useState<Profile | null>(null);
  async function submit(form: FormData) {
    const profile: Profile = { id: crypto.randomUUID(), role: "customer", full_name: String(form.get("name")), email: String(form.get("email")), phone: normalizePhoneForSave(String(form.get("phone"))), pin_code: String(form.get("pin")), date_of_birth: String(form.get("dob")), anniversary: String(form.get("anniversary") || ""), member_id: memberId(), created_at: nowIso() };
    const saved = await saveProfile(profile, String(form.get("pin") || "1234"));
    await addMessage(saved.id, "welcome", "Welcome to Afghan Kabob Rewards", `Hi ${saved.full_name}, your rewards profile is active.`);
    setCreated(saved);
  }
  if (created) return <div className="grid lg:grid-cols-2 gap-8 items-start"><div className="card p-8"><h1 className="text-4xl font-black">Rewards profile created</h1><p className="mt-3 text-[#766d65] font-semibold">Use this member ID in-store, or log in later with email and PIN.</p><div className="mt-6 text-3xl font-black text-kabob-green">{created.member_id}</div></div><div className="card p-8 text-center"><Image alt="Rewards QR" src={qrUrl(`${process.env.NEXT_PUBLIC_APP_URL || "https://afghankabob.ca"}/account?member=${created.member_id}`)} width={260} height={260} className="mx-auto" /><div className="font-black mt-4">{created.member_id}</div></div></div>;
  return (
    <section className="grid lg:grid-cols-[1fr_420px] gap-8 items-start">
      <form action={submit} className="card p-8 md:p-10 space-y-5">
        <h1 className="text-5xl font-black">Join Rewards</h1>
        <p className="text-[#766d65] font-semibold">Sign up for birthday, anniversary, and special offers.</p>
        <Field name="name" label="Name" required />
        <Field name="email" label="Email" type="email" required />
        <PhoneField name="phone" label="Phone number" required />
        <Field name="pin" label="Password or 4-digit PIN" required />
        <div className="grid md:grid-cols-2 gap-4"><Field name="dob" label="Date of birth" type="date" required /><Field name="anniversary" label="Anniversary" type="date" /></div>
        <label className="flex gap-3 text-sm font-bold"><input required type="checkbox" /> I agree to receive Afghan Kabob Rewards messages. I can unsubscribe anytime.</label>
        <button className="btn-primary">Join Rewards</button>
      </form>
      <div className="card p-8 text-center"><h2 className="text-2xl font-black mb-4">Printed QR signup</h2><Image alt="Rewards Signup QR" src={qrUrl(`${process.env.NEXT_PUBLIC_APP_URL || "https://afghankabob.ca"}/rewards`)} width={260} height={260} className="mx-auto" /><p className="text-sm text-[#766d65] font-semibold mt-4">Print this for the counter/table so customers can scan and join.</p></div>
    </section>
  );
}

function Login({ title, role, login, activeProfile, store }: { title: string; role: Role; login: (e: string, p: string, r?: Role) => Promise<boolean>; activeProfile: Profile | null; store: Store }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  if (activeProfile?.role === role) return <Account store={store} profile={activeProfile} />;
  return (
    <section className="w-full max-w-[560px]">
      <div className="card p-8 md:p-10">
        <div className="text-center mb-8">
          <p className="text-kabob-green font-black tracking-[0.18em] uppercase text-xs mb-3">Afghan Kabob Rewards</p>
          <h1 className="text-5xl font-black">{title}</h1>
          <p className="text-[#74675d] font-semibold mt-3">Access your QR pass, previous orders, rewards, and meal balance.</p>
        </div>
        <label className="label">Email</label>
        <input className="input mb-4" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" />
        <label className="label">Password or PIN</label>
        <input className="input mb-6" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Enter password or PIN" type="password" />
        <button className="btn-primary w-full" onClick={async()=>{ if (await login(email,password,role)) window.location.href = "/account"; }}>Login</button>
        <button type="button" className="btn-beta w-full mt-3" disabled>Continue with Google · Beta</button>
      </div>
    </section>
  );
}

function TeamLogin({ login, activeRole }: { login: (e: string, p: string, r?: Role) => Promise<boolean>; activeRole: Role | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (activeRole === "staff") router.replace("/staff");
    if (activeRole === "owner") router.replace("/owner");
  }, [activeRole, router]);

  return (
    <section className="w-full max-w-[560px]">
      <div className="card p-8 md:p-10">
        <div className="text-center mb-8">
          <p className="text-kabob-green font-black tracking-[0.18em] uppercase text-xs mb-3">Private access</p>
          <h1 className="text-5xl font-black">Staff / Owner Login</h1>
          <p className="text-[#74675d] font-semibold mt-3">Use your staff or owner credentials.</p>
        </div>
        <label className="label">Email</label>
        <input className="input mb-4" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="name@afghankabob.ca" />
        <label className="label">Password</label>
        <input className="input mb-6" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Enter password" type="password" />
        <button className="btn-primary w-full" onClick={async()=>{ const ok = await login(email,password); if (ok) window.location.href = email.toLowerCase().includes("owner") ? "/owner" : "/staff"; }}>Login</button>
      </div>
    </section>
  );
}

function Account({ store, profile }: { store: Store; profile: Profile | null }) {
  const customer = profile || store.profiles.find((p) => p.role === "customer")!;
  return <PassCard customer={customer} store={store} />;
}

function PassCard({ customer, store }: { customer: Profile; store: Store }) {
  const pass = store.passes.find((p) => p.customer_id === customer.id);
  const orders = store.orders.filter((o) => o.customer_id === customer.id);
  const reds = store.redemptions.filter((r) => r.customer_id === customer.id);
  const messages = store.messages.filter((m) => m.customer_id === customer.id);
  return (
    <section className="space-y-8">
      <div className="card p-7 md:p-10 grid lg:grid-cols-[1fr_300px] gap-8 items-start">
        <div className="space-y-7">
          <CustomerSummary customer={customer} pass={pass} />
          <CustomerDetails customer={customer} pass={pass} />
        </div>
        <QrPanel customer={customer} size={260} />
      </div>
      <CustomerTables customer={customer} store={store}/>
    </section>
  );
}

function Staff({ store, setStore, addMessage, addAuditLog, logout }: { store: Store; setStore: React.Dispatch<React.SetStateAction<Store>>; addMessage: (id: string, t: string, s: string, b: string) => Promise<void>; addAuditLog: (a: string, e: string, n: string, b: string | null, af: string | null) => Promise<void>; logout: () => void }) {
  const customers = store.profiles.filter((p) => p.role === "customer");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(customers[0]?.id || "");
  const selected = customers.find((c) => c.id === selectedId) || customers[0];
  const pass = store.passes.find((p) => p.customer_id === selected?.id);
  const customerOrders = store.orders.filter((o) => o.customer_id === selected?.id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const latestOrder = customerOrders[0];
  const selectedMealItems = latestOrder ? (store.orderItems[latestOrder.id] || []) : [];
  const selectedMealOptions = selectedMealItems.length
    ? selectedMealItems.flatMap((i) => Array.from({ length: i.quantity || 1 }, () => ({ name: i.name, category: i.category, price: i.price })))
    : [];
  const [itemName, setItemName] = useState(selectedMealOptions[0]?.name || "");
  const [editUnlocked, setEditUnlocked] = useState(false);
  const [editCode, setEditCode] = useState("");

  useEffect(() => {
    if (selectedMealOptions.length && !selectedMealOptions.some((i) => i.name === itemName)) setItemName(selectedMealOptions[0].name);
    if (!selectedMealOptions.length) setItemName("");
  }, [selectedId, selectedMealOptions.map((i) => i.name).join("|"), itemName]);

  const filtered = customers.filter((c) => [c.full_name, c.email, c.phone, c.member_id].join(" ").toLowerCase().includes(query.toLowerCase()));

  async function redeem() {
    if (!selected || !pass) return;
    if (pass.meals_used >= pass.meals_included) return alert("No meals left.");
    const item = selectedMealOptions.find((i) => i.name === itemName);
    if (!item) return;
    const remaining = pass.meals_included - pass.meals_used - 1;
    const red: Redemption = { id: crypto.randomUUID(), customer_id: selected.id, meal_pass_id: pass.id, staff_id: activeUserIdForRedemption(), item_name: item.name, category: item.category, meals_remaining: remaining, created_at: nowIso() };
    setStore((s) => ({ ...s, passes: s.passes.map((p) => p.id === pass.id ? { ...p, meals_used: p.meals_used + 1 } : p), redemptions: [red, ...s.redemptions] }));
    if (isSupabaseConfigured) {
      const supabase = supabaseBrowser();
      await supabase?.from("meal_passes").update({ meals_used: pass.meals_used + 1 }).eq("id", pass.id);
      await supabase?.from("redemptions").insert(red);
    }
    await addMessage(selected.id, "meal_redeemed", "Your meal pass was used", `${item.name} redeemed. ${remaining} meals remaining.`);
  }

  async function markInStorePaid(order: Order) {
    if (!selected) return;
    const paidAt = nowIso();
    const updated = { ...order, payment_status: "paid_in_store", paid_at: paidAt } as Order;
    setStore((s) => ({ ...s, orders: s.orders.map((o) => o.id === order.id ? updated : o) }));
    await addAuditLog("marked_in_store_order_paid", "order", order.id, JSON.stringify(order), JSON.stringify(updated));
    if (isSupabaseConfigured) {
      await supabaseBrowser()?.from("orders").update({ payment_status: "paid_in_store", paid_at: paidAt }).eq("id", order.id);
    }
    await addMessage(selected.id, "payment_confirmed", "In-store payment received", `Your in-store payment was recorded on ${new Date(paidAt).toLocaleString()}.`);
  }

  function activeUserIdForRedemption() {
    try {
      const raw = localStorage.getItem(SESSION);
      if (!raw) return demoStaffId;
      return (JSON.parse(raw) as ActiveSession).id || demoStaffId;
    } catch {
      return demoStaffId;
    }
  }

  return (
    <section>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-5xl font-black">Staff check-in</h1>
          <p className="text-[#74675d] font-semibold mt-2">Search a customer, scan their QR/member ID, redeem meals, and view history.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href="/staff/menu" className="btn-secondary">Menu edits</a>
          <button onClick={logout} className="btn-secondary">Logout</button>
        </div>
      </div>
      <div className="grid lg:grid-cols-[340px_1fr] gap-8">
        <div className="card p-5 h-fit">
          <h2 className="text-2xl font-black mb-4">Search / scan</h2>
          <input className="input mb-4" placeholder="Name, phone, email, member ID" value={query} onChange={(e)=>setQuery(e.target.value)} />
          <button className="btn-primary w-full mb-5" onClick={()=>setQuery("AKR-AA4QN")}>Scan QR</button>
          <div className="space-y-3 max-h-[600px] overflow-auto">
            {filtered.map((c)=>{const p=store.passes.find(x=>x.customer_id===c.id);return <button key={c.id} onClick={()=>setSelectedId(c.id)} className={`w-full text-left border rounded-2xl p-3 hover:bg-kabob-cream ${selected?.id === c.id ? "border-kabob-green bg-kabob-cream" : "border-kabob-sand"}`}><div className="font-black">{c.full_name}</div><div className="text-sm text-[#766d65]">{c.member_id} • {c.phone}</div><div className="font-black text-kabob-green">{p ? `${p.meals_included-p.meals_used}/${p.meals_included} meals left` : "Rewards only"}</div></button>})}
          </div>
        </div>
        {selected && <div className="space-y-6">
          <div className="card p-7 md:p-8 grid xl:grid-cols-[1fr_260px] gap-8 items-start">
            <div className="space-y-7">
              <CustomerSummary customer={selected} pass={pass} />
              <CustomerDetails customer={selected} pass={pass} />
              <div>
                <h3 className="text-2xl font-black mb-3">Redeem meal</h3>
                <select className="input mb-4" value={itemName} onChange={(e)=>setItemName(e.target.value)} disabled={!selectedMealOptions.length}>{selectedMealOptions.length ? selectedMealOptions.map((i, idx)=><option key={`${i.name}-${idx}`} value={i.name}>{i.name} — selected in order — {money(i.price)}</option>) : <option>No selected meals on this customer pass</option>}</select>
                <div className="flex flex-wrap gap-3">
                  <button className="btn-primary" onClick={redeem}>Redeem selected meal</button>
                  <button className="btn-secondary" onClick={()=>addMessage(selected.id,"balance","Your Afghan Kabob balance",`You have ${pass ? pass.meals_included-pass.meals_used : 0} meals remaining.`)}>Send balance</button>
                </div>
              </div>
            </div>
            <QrPanel customer={selected} size={230} />
          </div>
          <InStorePaymentPanel orders={customerOrders} onMarkPaid={markInStorePaid} />
          <SelectedMealsPanel items={selectedMealItems} />
          <CustomerTables customer={selected} store={store}/>
        </div>}
      </div>
    </section>
  );
}


function StaffMenu({ store, setStore, addAuditLog, logout }: { store: Store; setStore: React.Dispatch<React.SetStateAction<Store>>; addAuditLog: (a: string, e: string, n: string, b: string | null, af: string | null) => Promise<void>; logout: () => void }) {
  const [editUnlocked, setEditUnlocked] = useState(false);
  const [editCode, setEditCode] = useState("");
  return (
    <section>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-5xl font-black">Menu edits</h1>
          <p className="text-[#74675d] font-semibold mt-2">Staff can update menu listings only after entering the manager code. Every change is saved in the owner change log.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href="/staff" className="btn-secondary">Back to check-in</a>
          <button onClick={logout} className="btn-secondary">Logout</button>
        </div>
      </div>
      <StaffEditPanel store={store} setStore={setStore} editCode={editCode} setEditCode={setEditCode} editUnlocked={editUnlocked} setEditUnlocked={setEditUnlocked} addAuditLog={addAuditLog} />
    </section>
  );
}

function Owner({ store, setStore, addAuditLog, logout }: { store: Store; setStore: React.Dispatch<React.SetStateAction<Store>>; addAuditLog: (a: string, e: string, n: string, b: string | null, af: string | null) => Promise<void>; logout: () => void }) {
  const [q, setQ] = useState("");
  const [selectedTab, setSelectedTab] = useState<"customers" | "activity" | "messages" | "menu" | "passes" | "offers" | "changes">("customers");
  const [editingName, setEditingName] = useState(store.menuItems[0]?.name || "");
  const editingItem = store.menuItems.find((i) => i.name === editingName) || store.menuItems[0];
  const [draft, setDraft] = useState<MenuItem>(editingItem || { name: "", category: "Kabob", price: 0, image_url: "" });

  useEffect(() => {
    const item = store.menuItems.find((i) => i.name === editingName) || store.menuItems[0];
    if (item) setDraft({ ...item });
  }, [editingName, store.menuItems]);

  const customers = store.profiles.filter((p) => p.role === "customer" && [p.full_name,p.email,p.phone,p.member_id].join(" ").toLowerCase().includes(q.toLowerCase()));
  const redRows = store.redemptions.map((r)=>{const c=store.profiles.find(p=>p.id===r.customer_id); const st=store.profiles.find(p=>p.id===r.staff_id); return [new Date(r.created_at).toLocaleString(), c?.full_name||"", r.item_name, st?.full_name||"Staff", String(r.meals_remaining ?? "")];});

  async function saveMenuItem() {
    if (!draft.name.trim()) return;
    const before = store.menuItems.find((i) => i.name === editingName);
    await addAuditLog(before ? "updated_menu_item" : "created_menu_item", "menu_item", draft.name, before ? JSON.stringify(before) : null, JSON.stringify(draft));
    setStore((s) => ({
      ...s,
      menuItems: s.menuItems.some((i) => i.name === editingName)
        ? s.menuItems.map((i) => i.name === editingName ? { ...draft, price: Number(draft.price) } : i)
        : [{ ...draft, price: Number(draft.price) }, ...s.menuItems]
    }));
    setEditingName(draft.name);
    if (isSupabaseConfigured) {
      await supabaseBrowser()?.from("menu_items").upsert({ name: draft.name, category: draft.category, price: Number(draft.price), image_url: draft.image_url || null, description: draft.description || null, active: true }, { onConflict: "name" });
    }
  }

  async function updateOffer(type: "birthdayDiscount" | "anniversaryDiscount", value: string) {
    const percent = Number(value) || 0;
    await addAuditLog("updated_offer_setting", "offer_setting", type, String(store[type]), String(percent));
    setStore((s) => ({ ...s, [type]: percent }));
  }

  return (
    <section>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-5xl font-black">Owner dashboard</h1>
          <p className="text-[#74675d] font-semibold mt-2">Manage customers, activity, messages, menu listings, photos, and offer settings.</p>
        </div>
        <button onClick={logout} className="btn-secondary">Logout</button>
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <Metric label="Customers" value={String(customers.length)}/>
        <Metric label="Active passes" value={String(store.passes.filter(p=>p.status==='active').length)}/>
        <Metric label="Redemptions" value={String(store.redemptions.length)}/>
        <Metric label="Messages" value={String(store.messages.length)}/>
      </div>

      <div className="card p-3 md:p-4 mb-8 flex flex-wrap gap-2">
        {[
          ["customers", "Customers"],
          ["activity", "Activity log"],
          ["messages", "Email / SMS"],
          ["menu", "Menu listings"],
          ["passes", "Meal pass pricing"],
          ["offers", "Offer settings"],
          ["changes", "Change log"]
        ].map(([key,label]) => <button key={key} onClick={()=>setSelectedTab(key as any)} className={selectedTab === key ? "btn-primary" : "btn-secondary"}>{label}</button>)}
      </div>

      {selectedTab === "customers" && <div className="card p-6 mb-8"><div className="flex flex-col md:flex-row md:justify-between gap-4 mb-5"><h2 className="text-3xl font-black">Customer table</h2><input className="input md:max-w-sm" placeholder="Filter customers" value={q} onChange={(e)=>setQ(e.target.value)} /></div><div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>DOB</th><th>Anniversary</th><th>Tier</th><th>Meals left</th><th>Total spent</th></tr></thead><tbody>{customers.map((c)=>{const p=store.passes.find(x=>x.customer_id===c.id); const spent=store.orders.filter(o=>o.customer_id===c.id).reduce((a,o)=>a+o.total,0); return <tr key={c.id}><td className="font-black">{c.full_name}<br/><span className="text-xs text-[#766d65]">{c.member_id}</span></td><td>{c.email}</td><td>{c.phone}</td><td>{formatDate(c.date_of_birth)}</td><td>{formatDate(c.anniversary)}</td><td>{p?.tier || "Rewards"}</td><td>{p ? `${p.meals_included-p.meals_used}/${p.meals_included}` : "—"}</td><td>{money(spent)}</td></tr>})}</tbody></table></div></div>}

      {selectedTab === "activity" && <History title="Activity log" headers={["Date","Customer","Item","Redeemed by","Remaining"]} rows={redRows}/>} 

      {selectedTab === "messages" && <div className="card p-6"><h2 className="text-3xl font-black mb-5">Email / SMS outbox</h2><div className="table-wrap"><table><thead><tr><th>Date</th><th>Customer</th><th>Channel</th><th>Type</th><th>Subject</th><th>Status</th><th></th></tr></thead><tbody>{store.messages.map((m)=>{const c=store.profiles.find(p=>p.id===m.customer_id); return <tr key={m.id}><td>{new Date(m.created_at).toLocaleString()}</td><td>{c?.full_name}</td><td>{m.channel}</td><td>{m.message_type}</td><td>{m.subject}</td><td><span className="pill">{m.status}</span></td><td><button className="btn-secondary !py-2" onClick={()=>setStore(s=>({...s,messages:s.messages.map(x=>x.id===m.id?{...x,status:"resent",sent_at:nowIso()}:x)}))}>Resend</button></td></tr>})}</tbody></table></div></div>}

      {selectedTab === "menu" && <div className="grid lg:grid-cols-[360px_1fr] gap-8">
        <div className="card p-5 h-fit">
          <h2 className="text-3xl font-black mb-4">Menu listings</h2>
          <button className="btn-primary w-full mb-4" onClick={()=>{ setEditingName("new"); setDraft({ name: "", category: "Kabob", price: 0, image_url: "" }); }}>Add new item</button>
          <div className="space-y-2 max-h-[560px] overflow-auto">
            {store.menuItems.map((item) => <button key={item.name} className={`w-full text-left border rounded-2xl p-3 ${editingName === item.name ? "border-kabob-green bg-kabob-cream" : "border-kabob-sand"}`} onClick={()=>setEditingName(item.name)}><div className="font-black">{item.name}</div><div className="text-sm text-[#766d65]">{item.category} • {money(item.price)}</div></button>)}
          </div>
        </div>
        <div className="card p-6 md:p-8">
          <h2 className="text-3xl font-black mb-5">Edit listing</h2>
          <div className="grid md:grid-cols-2 gap-5">
            <label><span className="label">Item name</span><input className="input" value={draft.name} onChange={(e)=>setDraft({...draft, name:e.target.value})}/></label>
            <label><span className="label">Category</span><select className="input" value={draft.category} onChange={(e)=>setDraft({...draft, category:e.target.value})}>{["Kabob","Donair","Specials","Platters","Sides","Drinks"].map(c=><option key={c}>{c}</option>)}</select></label>
            <PriceInput label="Price" value={draft.price} onChange={(v)=>setDraft({...draft, price:v})} />
            <label><span className="label">Image URL</span><input className="input" value={draft.image_url || ""} onChange={(e)=>setDraft({...draft, image_url:e.target.value})} placeholder="https://..."/></label>
            <label className="md:col-span-2"><span className="label">Description</span><textarea className="input min-h-[110px]" value={draft.description || ""} onChange={(e)=>setDraft({...draft, description:e.target.value})} placeholder="Short item description shown under the accordion."/></label>
            <label className="md:col-span-2"><span className="label">Upload image</span><input className="input" type="file" accept="image/*" onChange={(e)=>{ const file=e.target.files?.[0]; if(file) readImageFile(file, (url)=>setDraft({...draft, image_url:url})); }}/></label>
            {draft.image_url && <div className="md:col-span-2 menu-image-preview"><img src={draft.image_url} alt={draft.name || "Menu item preview"}/><span>Image preview</span></div>}
          </div>
          <button className="btn-primary mt-6" onClick={saveMenuItem}>Save listing</button>
          <p className="text-sm text-[#74675d] font-semibold mt-4">Owners can edit menu listings here. Staff can edit from the separate Menu edits page only with the manager code. Every change is saved in the change log.</p>
        </div>
      </div>}

      {selectedTab === "passes" && <MealPlanEditor store={store} setStore={setStore} addAuditLog={addAuditLog} />}

      {selectedTab === "offers" && <div className="card p-6 md:p-8 max-w-[760px]"><h2 className="text-3xl font-black mb-5">Offer settings</h2><div className="grid md:grid-cols-2 gap-5"><label><span className="label">Birthday discount %</span><input className="input" type="number" value={store.birthdayDiscount} onChange={(e)=>updateOffer("birthdayDiscount", e.target.value)}/></label><label><span className="label">Anniversary discount %</span><input className="input" type="number" value={store.anniversaryDiscount} onChange={(e)=>updateOffer("anniversaryDiscount", e.target.value)}/></label></div><p className="text-sm text-[#74675d] font-semibold mt-4">These settings control the birthday and anniversary offers shown in the owner messaging workflow.</p></div>}

      {selectedTab === "changes" && <History title="Change log" headers={["Date","Changed by","Action","Entity","Before","After"]} rows={(store.auditLogs || []).map((l)=>[new Date(l.created_at).toLocaleString(), l.actor_name, l.action, `${l.entity_type}: ${l.entity_name}`, l.before_value || "—", l.after_value || "—"])}/>}
    </section>
  );
}


function MealItemCard({ item, onAdd, selectedQuantity = 0 }: { item: MenuItem; onAdd: () => void; selectedQuantity?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`card p-5 meal-card ${selectedQuantity ? "meal-card-selected" : ""}`}>
      <div className="meal-card-image">
        {item.image_url ? <img src={item.image_url} alt={item.name} /> : <span>🍽️</span>}
      </div>
      <div className="flex items-start justify-between gap-3 mt-4">
        <div>
          <h3 className="font-black text-xl leading-6">{item.name}</h3>
          <p className="text-sm font-bold text-[#766d65] mt-1">{item.category} • {money(item.price)}</p>
        </div>
        <button type="button" className="accordion-arrow" aria-label="Show description" onClick={() => setOpen(!open)}>{open ? "⌃" : "⌄"}</button>
      </div>
      {open && <p className="meal-description">{item.description || "Freshly prepared Afghan Kabob menu item."}</p>}
      <button onClick={onAdd} className="btn-primary w-full mt-5">{selectedQuantity ? `Selected x${selectedQuantity}` : "Add to order"}</button>
    </div>
  );
}

function SelectedMealsPanel({ items }: { items: OrderItem[] }) {
  return (
    <div className="card p-6">
      <h2 className="text-2xl font-black mb-4">Meals selected in this pass</h2>
      {items.length ? (
        <div className="grid md:grid-cols-2 gap-3">
          {items.map((item) => (
            <div key={`${item.name}-${item.quantity}`} className="card-soft p-4 flex justify-between gap-4">
              <div><div className="font-black">{item.name}</div><div className="text-sm font-bold text-[#74675d]">{item.category}</div></div>
              <div className="font-black text-kabob-green">x{item.quantity}</div>
            </div>
          ))}
        </div>
      ) : <p className="text-[#74675d] font-semibold">No selected meals found for this customer. Create or renew a meal pass first.</p>}
    </div>
  );
}

function StaffEditPanel({ store, setStore, editCode, setEditCode, editUnlocked, setEditUnlocked, addAuditLog }: { store: Store; setStore: React.Dispatch<React.SetStateAction<Store>>; editCode: string; setEditCode: (v: string) => void; editUnlocked: boolean; setEditUnlocked: (v: boolean) => void; addAuditLog: (a: string, e: string, n: string, b: string | null, af: string | null) => Promise<void>; }) {
  const [editingName, setEditingName] = useState(store.menuItems[0]?.name || "");
  const item = store.menuItems.find((i) => i.name === editingName) || store.menuItems[0] || { name: "", category: "Kabob", price: 0, image_url: "" };
  const [draft, setDraft] = useState<MenuItem>(item);

  useEffect(() => {
    const next = store.menuItems.find((i) => i.name === editingName) || store.menuItems[0];
    if (next) setDraft({ ...next });
  }, [editingName, store.menuItems]);

  async function save() {
    const before = store.menuItems.find((i) => i.name === editingName);
    await addAuditLog(before ? "staff_updated_menu_item" : "staff_created_menu_item", "menu_item", draft.name, before ? JSON.stringify(before) : null, JSON.stringify(draft));
    setStore((s) => ({
      ...s,
      menuItems: s.menuItems.some((i) => i.name === editingName)
        ? s.menuItems.map((i) => i.name === editingName ? { ...draft, price: Number(draft.price) } : i)
        : [{ ...draft, price: Number(draft.price) }, ...s.menuItems]
    }));
    if (isSupabaseConfigured) {
      await supabaseBrowser()?.from("menu_items").upsert({ name: draft.name, category: draft.category, price: Number(draft.price), image_url: draft.image_url || null, description: draft.description || null, active: true }, { onConflict: "name" });
    }
  }

  return (
    <div className="card p-6">
      <h2 className="text-2xl font-black mb-2">Edit menu listing</h2>
      <p className="text-[#74675d] font-semibold mb-5">Choose an item, edit details, upload a photo, then save. Changes are logged for the owner.</p>
      {!editUnlocked ? (
        <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
          <input className="input" value={editCode} onChange={(e)=>setEditCode(e.target.value)} placeholder="Enter manager code" type="password" />
          <button className="btn-primary" onClick={()=> editCode === store.managerEditCode ? setEditUnlocked(true) : alert("Invalid manager code")}>Unlock edits</button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[300px_1fr] gap-6">
          <div className="space-y-2 max-h-[420px] overflow-auto">
            <button className="btn-primary w-full mb-2" onClick={()=>{ setEditingName("new"); setDraft({ name: "", category: "Kabob", price: 0, image_url: "" }); }}>Add new item</button>
            {store.menuItems.map((m)=><button key={m.name} className={`w-full text-left border rounded-2xl p-3 ${editingName === m.name ? "border-kabob-green bg-kabob-cream" : "border-kabob-sand"}`} onClick={()=>setEditingName(m.name)}><div className="font-black">{m.name}</div><div className="text-sm text-[#74675d]">{m.category} • {money(m.price)}</div></button>)}
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            <label><span className="label">Item name</span><input className="input" value={draft.name} onChange={(e)=>setDraft({...draft, name:e.target.value})}/></label>
            <label><span className="label">Category</span><select className="input" value={draft.category} onChange={(e)=>setDraft({...draft, category:e.target.value})}>{["Kabob","Donair","Specials","Platters","Sides","Drinks"].map(c=><option key={c}>{c}</option>)}</select></label>
            <PriceInput label="Price" value={draft.price} onChange={(v)=>setDraft({...draft, price:v})} />
            <label><span className="label">Image URL</span><input className="input" value={draft.image_url || ""} onChange={(e)=>setDraft({...draft, image_url:e.target.value})}/></label>
            <label className="md:col-span-2"><span className="label">Upload image</span><input className="input" type="file" accept="image/*" onChange={(e)=>{ const file=e.target.files?.[0]; if(file) readImageFile(file, (url)=>setDraft({...draft, image_url:url})); }}/></label>
            {draft.image_url && <div className="md:col-span-2 menu-image-preview"><img src={draft.image_url} alt={draft.name || "Menu item preview"}/><span>Image preview</span></div>}
            <div className="md:col-span-2"><button className="btn-primary" onClick={save}>Save change</button></div>
          </div>
          <div className="lg:col-span-2 mt-6">
            <MealPlanEditor store={store} setStore={setStore} addAuditLog={addAuditLog} staffMode />
          </div>
        </div>
      )}
    </div>
  );
}

function InStorePaymentPanel({ orders, onMarkPaid }: { orders: Order[]; onMarkPaid: (order: Order) => void }) {
  const inStore = orders.filter((o) => o.order_type === "in_store");
  if (!inStore.length) return null;
  return (
    <div className="card p-6">
      <h2 className="text-2xl font-black mb-3">In-store payment</h2>
      <div className="space-y-3">
        {inStore.map((order) => {
          const paid = order.payment_status === "paid_in_store" || order.payment_status === "paid";
          return (
            <label key={order.id} className={`payment-row ${paid ? "payment-row-paid" : ""}`}>
              <input type="checkbox" checked={paid} disabled={paid} onChange={() => onMarkPaid(order)} />
              <div>
                <div className="font-black">{money(order.total)} · {paid ? "Paid in store" : "Needs in-store payment"}</div>
                <div className="text-sm font-bold text-[#74675d]">Submitted {new Date(order.created_at).toLocaleString()}{order.paid_at ? ` · Paid ${new Date(order.paid_at).toLocaleString()}` : ""}</div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function CustomerTables({ customer, store }: { customer: Profile; store: Store }) {
  const orders = store.orders.filter((o)=>o.customer_id===customer.id);
  const reds = store.redemptions.filter((r)=>r.customer_id===customer.id);
  const msgs = store.messages.filter((m)=>m.customer_id===customer.id);
  return <div className="space-y-6"><History title="Previous orders" headers={["Date","Type","Total","Status","Paid date"]} rows={orders.map((o)=>[new Date(o.created_at).toLocaleString(),o.order_type,money(o.total),o.payment_status,o.paid_at ? new Date(o.paid_at).toLocaleString() : "—"])}/><History title="Previous redemptions" headers={["Date","Item","Category","Remaining"]} rows={reds.map((r)=>[new Date(r.created_at).toLocaleString(),r.item_name,r.category||"",String(r.meals_remaining ?? "")])}/><History title="Messages" headers={["Date","Type","Channel","Status"]} rows={msgs.map((m)=>[new Date(m.created_at).toLocaleString(),m.message_type,m.channel,m.status])}/></div>;
}

function CustomerSummary({ customer, pass }: { customer: Profile; pass?: MealPass }) {
  return (
    <div>
      <h2 className="text-4xl md:text-5xl font-black leading-tight">{customer.full_name}</h2>
      <p className="customer-line mt-3">{customer.phone || "No phone"} <span>•</span> {customer.email || "No email"}</p>
      <p className="customer-line">Member ID: <strong>{customer.member_id || "—"}</strong></p>
      {pass && <p className="customer-line">Pass: <strong>{pass.tier}</strong> <span>•</span> {pass.frequency} <span>•</span> {pass.status}</p>}
    </div>
  );
}

function CustomerDetails({ customer, pass }: { customer: Profile; pass?: MealPass }) {
  const rows = [
    ["Date of birth", formatDate(customer.date_of_birth)],
    ["Anniversary", formatDate(customer.anniversary)],
    ["Tier", pass?.tier || "Rewards only"],
    ["Meals left", pass ? `${pass.meals_included - pass.meals_used} of ${pass.meals_included}` : "—"],
    ["Frequency", pass?.frequency || "—"],
    ["Renewal", formatDate(pass?.renewal_date)]
  ];
  return <dl className="profile-detail-grid">{rows.map(([label, value]) => <div className="profile-detail-row" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

function QrPanel({ customer, size }: { customer: Profile; size: number }) {
  return <div className="card-soft p-5 text-center"><Image alt="Member QR" src={qrUrl(customer.member_id || customer.id)} width={size} height={size} className="mx-auto" /><div className="text-xl font-black mt-4">{customer.member_id}</div></div>;
}

function PhoneField({ name, label, required=false }: { name: string; label: string; required?: boolean }) {
  const [value, setValue] = useState("");
  return <label><span className="label">{label}{required ? " *" : ""}</span><input className="input" name={name} type="tel" inputMode="tel" placeholder="(306) 555-7788" value={value} onChange={(e)=>setValue(formatCanadianPhoneInput(e.target.value))} required={required}/></label>;
}

function MealPlanEditor({ store, setStore, addAuditLog, staffMode=false }: { store: Store; setStore: React.Dispatch<React.SetStateAction<Store>>; addAuditLog: (a: string, e: string, n: string, b: string | null, af: string | null) => Promise<void>; staffMode?: boolean }) {
  const [selectedId, setSelectedId] = useState(store.mealPlans[0]?.id || "");
  const selected = store.mealPlans.find((p)=>p.id===selectedId) || store.mealPlans[0];
  const [draft, setDraft] = useState<MealPlan>(selected || defaultMealPlans[0]);

  useEffect(() => {
    const next = store.mealPlans.find((p)=>p.id===selectedId) || store.mealPlans[0];
    if (next) setDraft({ ...next, categories: [...next.categories] });
  }, [selectedId, store.mealPlans]);

  async function savePlan() {
    if (!draft.id.trim() || !draft.tier.trim()) return;
    const before = store.mealPlans.find((p)=>p.id===selectedId);
    const clean = { ...draft, meals: Number(draft.meals), price: Number(draft.price), compareAt: draft.compareAt ? Number(draft.compareAt) : undefined, categories: draft.categories.filter(Boolean) };
    await addAuditLog(staffMode ? "staff_updated_meal_pass" : "updated_meal_pass", "meal_plan", clean.tier, before ? JSON.stringify(before) : null, JSON.stringify(clean));
    setStore((s)=>({ ...s, mealPlans: s.mealPlans.some((p)=>p.id===selectedId) ? s.mealPlans.map((p)=>p.id===selectedId ? clean : p) : [clean, ...s.mealPlans] }));
    setSelectedId(clean.id);
    if (isSupabaseConfigured) {
      await supabaseBrowser()?.from("meal_plan_settings").upsert({ id: clean.id, frequency: clean.frequency, tier: clean.tier, meals: clean.meals, price: clean.price, compare_at: clean.compareAt || null, categories: clean.categories, description: clean.description, active: true }, { onConflict: "id" });
    }
  }

  return <div className="card p-6 md:p-8">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
      <div><h2 className="text-3xl font-black">Meal pass pricing</h2><p className="text-[#74675d] font-semibold mt-1">Change daily, weekly, and monthly pass prices, meal counts, and eligible categories.</p></div>
      <button className="btn-secondary" onClick={()=>{ const id=`custom-${Date.now()}`; setSelectedId(id); setDraft({ id, frequency: "weekly", tier: "New Pass", meals: 1, price: 0, compareAt: undefined, categories: ["Kabob"], description: "" }); }}>Add pass</button>
    </div>
    <div className="grid lg:grid-cols-[330px_1fr] gap-6">
      <div className="space-y-2 max-h-[420px] overflow-auto">
        {store.mealPlans.map((p)=><button key={p.id} className={`w-full text-left border rounded-2xl p-3 ${selectedId === p.id ? "border-kabob-green bg-kabob-cream" : "border-kabob-sand"}`} onClick={()=>setSelectedId(p.id)}><div className="font-black">{p.tier}</div><div className="text-sm text-[#74675d]">{p.frequency} • {p.meals} meals • {money(p.price)}</div></button>)}
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <label><span className="label">Plan ID</span><input className="input" value={draft.id} onChange={(e)=>setDraft({...draft, id:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"-")})}/></label>
        <label><span className="label">Frequency</span><select className="input" value={draft.frequency} onChange={(e)=>setDraft({...draft, frequency:e.target.value as MealPlan["frequency"]})}>{["daily","weekly","monthly"].map(f=><option key={f}>{f}</option>)}</select></label>
        <label><span className="label">Tier name</span><input className="input" value={draft.tier} onChange={(e)=>setDraft({...draft, tier:e.target.value})}/></label>
        <label><span className="label">Meals included</span><input className="input" type="number" value={draft.meals} onChange={(e)=>setDraft({...draft, meals:Number(e.target.value)})}/></label>
        <PriceInput label="Price" value={draft.price} onChange={(v)=>setDraft({...draft, price:v})} />
        <PriceInput label="Compare-at price" value={draft.compareAt || ""} onChange={(v)=>setDraft({...draft, compareAt:v || undefined})} />
        <label className="md:col-span-2"><span className="label">Eligible categories</span><input className="input" value={draft.categories.join(", ")} onChange={(e)=>setDraft({...draft, categories:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})} placeholder="Kabob, Donair, Specials"/></label>
        <label className="md:col-span-2"><span className="label">Description</span><textarea className="input min-h-[100px]" value={draft.description} onChange={(e)=>setDraft({...draft, description:e.target.value})}/></label>
        <div className="md:col-span-2"><button className="btn-primary" onClick={savePlan}>Save meal pass</button></div>
      </div>
    </div>
  </div>;
}

function PriceInput({ label, value, onChange }: { label: string; value: number | string; onChange: (value: number) => void }) {
  return (
    <label>
      <span className="label">{label}</span>
      <div className="price-input-wrap"><span>$</span><input className="input price-input" type="number" step="0.01" value={value} onChange={(e)=>onChange(Number(e.target.value))}/></div>
    </label>
  );
}

function Field({ name, label, type="text", required=false }: { name: string; label: string; type?: string; required?: boolean }) { return <label><span className="label">{label}{required ? " *" : ""}</span><input className="input" name={name} type={type} required={required}/></label>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="metric-card"><div className="metric-label">{label}</div><div className="metric-value">{value}</div></div>; }
function StepBar({ step }: { step: number }) { return <div className="flex items-center justify-center gap-3 mb-12 text-sm"><span className={step>=1?"step-pill step-active":"step-pill"}>1 Select a plan</span><span className="step-line"/><span className={step>=2?"step-pill step-active":"step-pill"}>2 Pick your meals</span><span className="step-line"/><span className={step>=3?"step-pill step-active":"step-pill"}>3 Submit order</span></div>; }
function OrderSummary({ plan, items }: { plan: MealPlan; items: OrderItem[] }) { const tax=+(plan.price*.11).toFixed(2); return <aside className="card p-6 h-fit sticky top-5"><h2 className="text-2xl font-black">Your Order</h2><div className="mt-4 space-y-3">{items.map((i)=><div key={i.name} className="flex justify-between gap-4 font-bold"><span>{i.quantity}x {i.name}</span><span>{money(i.price*i.quantity)}</span></div>)}</div><div className="border-t border-kabob-sand mt-5 pt-5 space-y-2 font-bold"><div className="flex justify-between"><span>{plan.meals} meals/{plan.frequency}</span><span>{money(plan.price)}</span></div><div className="flex justify-between"><span>Tax estimate</span><span>{money(tax)}</span></div><div className="flex justify-between text-xl font-black text-kabob-green"><span>Total</span><span>{money(plan.price+tax)}</span></div></div></aside>; }
function History({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) { return <div className="card p-6"><h2 className="text-2xl font-black mb-4">{title}</h2><div className="table-wrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((r,idx)=><tr key={idx}>{r.map((c,i)=><td key={i}>{c}</td>)}</tr>) : <tr><td colSpan={headers.length}>No records yet.</td></tr>}</tbody></table></div></div>; }
