"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { mealPlans, menuItems, getPlan } from "@/lib/plans";
import { memberId, qrUrl } from "@/lib/qr";
import { isSupabaseConfigured, supabaseBrowser } from "@/lib/supabase";
import type { MealPass, Message, Order, Profile, Redemption, Role } from "@/lib/types";

type View = "meal-pass" | "rewards" | "login" | "team-login" | "account" | "staff" | "owner";
type OrderItem = { name: string; category: string; price: number; quantity: number };

type Store = {
  profiles: Profile[];
  passes: MealPass[];
  orders: Order[];
  orderItems: Record<string, OrderItem[]>;
  redemptions: Redemption[];
  messages: Message[];
  passwords: Record<string, string>;
};

const nowIso = () => new Date().toISOString();
const money = (n: number) => `$${n.toFixed(2)}`;
const STORAGE = "akr-next-store-v2";

const demoCustomerId = "demo-customer-1";
const demoStaffId = "demo-staff-1";
const demoOwnerId = "demo-owner-1";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
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
    ]
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
  const [store, setStore] = useState<Store>(initialStore());
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE);
    if (raw) setStore(JSON.parse(raw));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE, JSON.stringify(store));
  }, [store]);

  const activeProfile = store.profiles.find((p) => p.id === activeUserId) || null;

  async function login(email: string, password: string, role?: Role) {
    const clean = email.trim().toLowerCase();

    if (isSupabaseConfigured) {
      const supabase = supabaseBrowser();
      const auth = await supabase?.auth.signInWithPassword({ email: clean, password });
      if (!auth?.error) {
        const { data: profile } = await supabase!
          .from("profiles")
          .select("*")
          .eq("email", clean)
          .maybeSingle();
        if (profile && (!role || profile.role === role)) {
          const typed = profile as Profile;
          setStore((s) => ({ ...s, profiles: s.profiles.some((p) => p.id === typed.id) ? s.profiles.map((p) => p.id === typed.id ? typed : p) : [typed, ...s.profiles] }));
          setActiveRole(typed.role);
          setActiveUserId(typed.id);
          setNotice(`Logged in as ${typed.full_name}.`);
          return true;
        }
      }
    }

    const profile = store.profiles.find((p) => p.email?.toLowerCase() === clean && (!role || p.role === role));
    if (!profile || store.passwords[clean] !== password) {
      setNotice("Login failed. Check email and password/PIN.");
      return false;
    }
    setActiveRole(profile.role);
    setActiveUserId(profile.id);
    setNotice(`Logged in as ${profile.full_name}.`);
    return true;
  }

  function logout() {
    setActiveRole(null);
    setActiveUserId(null);
    setNotice("Logged out.");
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
    setActiveRole(savedProfile.role);
    setActiveUserId(savedProfile.id);
    return savedProfile;
  }

  async function addMessage(customerId: string, type: string, subject: string, body: string, channel: "email" | "sms" = "email") {
    const msg: Message = { id: crypto.randomUUID(), customer_id: customerId, channel, message_type: type, subject, body, status: "queued", created_at: nowIso() };
    setStore((s) => ({ ...s, messages: [msg, ...s.messages] }));
    const customer = store.profiles.find((p) => p.id === customerId);
    if (customer?.email && channel === "email") {
      try {
        const res = await fetch("/api/email/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: customer.email, subject, body }) });
        setStore((s) => ({ ...s, messages: s.messages.map((m) => m.id === msg.id ? { ...m, status: res.ok ? "sent" : "failed", sent_at: res.ok ? nowIso() : null } : m) }));
      } catch {
        setStore((s) => ({ ...s, messages: s.messages.map((m) => m.id === msg.id ? { ...m, status: "failed" } : m) }));
      }
    }
  }

  return (
    <main className={view === "login" || view === "team-login" ? "page-shell auth-shell" : "page-shell"}>
      {notice && <div className="mb-6 rounded-2xl bg-kabob-cream border border-kabob-sand p-4 font-bold text-kabob-green">{notice}</div>}
      {view === "meal-pass" && <MealPass store={store} saveProfile={saveProfile} setStore={setStore} addMessage={addMessage} />}
      {view === "rewards" && <Rewards saveProfile={saveProfile} addMessage={addMessage} />}
      {view === "login" && <Login title="Customer login" role="customer" login={login} activeProfile={activeProfile} store={store} />}
      {view === "team-login" && <TeamLogin login={login} activeRole={activeRole} />}
      {view === "account" && <Account store={store} profile={activeProfile} />}
      {view === "staff" && <Staff store={store} setStore={setStore} addMessage={addMessage} logout={logout} />}
      {view === "owner" && <Owner store={store} setStore={setStore} logout={logout} />}
    </main>
  );
}

function MealPass({ store, saveProfile, setStore, addMessage }: { store: Store; saveProfile: (p: Profile, password: string) => Promise<Profile>; setStore: React.Dispatch<React.SetStateAction<Store>>; addMessage: (id: string, t: string, s: string, b: string) => Promise<void>; }) {
  const [frequency, setFrequency] = useState("weekly");
  const [planId, setPlanId] = useState("weekly-classic");
  const plan = getPlan(planId);
  const eligibleItems = menuItems.filter((item) => plan.categories.includes(item.category));
  const [items, setItems] = useState<OrderItem[]>([]);
  const [checkout, setCheckout] = useState(false);
  const [doneCustomer, setDoneCustomer] = useState<Profile | null>(null);

  useEffect(() => {
    const first = mealPlans.find((p) => p.frequency === frequency);
    if (first) setPlanId(first.id);
    setItems([]);
  }, [frequency]);

  function addItem(item: typeof menuItems[number]) {
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
      id: crypto.randomUUID(), role: "customer", full_name: String(form.get("name")), email: String(form.get("email")), phone: String(form.get("phone")), date_of_birth: String(form.get("dob") || ""), anniversary: String(form.get("anniversary") || ""), member_id: memberId(), pin_code: String(form.get("pin") || ""), created_at: nowIso()
    };
    const savedCustomer = await saveProfile(customer, String(form.get("pin") || "1234"));
    const passId = crypto.randomUUID();
    const orderId = crypto.randomUUID();
    const pass: MealPass = { id: passId, customer_id: savedCustomer.id, frequency: plan.frequency, tier: plan.tier, meals_included: plan.meals, meals_used: 0, price: plan.price, status: "active", start_date: new Date().toISOString().slice(0, 10), renewal_date: daysToRenewal(plan.frequency) };
    const order: Order = { id: orderId, customer_id: savedCustomer.id, meal_pass_id: passId, order_type: String(form.get("payMode")) === "in_store" ? "in_store" : "online", subtotal: plan.price, tax: +(plan.price * 0.11).toFixed(2), total: +(plan.price * 1.11).toFixed(2), payment_status: String(form.get("payMode")) === "in_store" ? "pending" : "paid", created_at: nowIso() };
    setStore((s) => ({ ...s, passes: [pass, ...s.passes], orders: [order, ...s.orders], orderItems: { ...s.orderItems, [orderId]: items.length ? items : eligibleItems.slice(0, plan.meals).map((i) => ({ ...i, quantity: 1 })) } }));
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
              <Field name="phone" label="Phone number" required />
              <Field name="pin" label="Password or 4-digit PIN" required />
              <Field name="dob" label="Date of birth" type="date" />
              <Field name="anniversary" label="Anniversary" type="date" />
            </div>
            <div className="card-soft p-5">
              <div className="font-black mb-3">Checkout method</div>
              <label className="mr-6 font-bold"><input name="payMode" type="radio" value="online" defaultChecked /> Pay online</label>
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
        {mealPlans.filter((p) => p.frequency === frequency).map((p) => (
          <button key={p.id} onClick={() => setPlanId(p.id)} className={`card p-7 text-left ${planId === p.id ? "ring-4 ring-[#10583f22] border-kabob-green" : ""}`}>
            <div className="text-2xl font-black">{p.tier}</div>
            <div className="text-lg font-extrabold text-kabob-green mt-2">{p.meals} meals / {p.frequency}</div>
            <div className="text-3xl font-black mt-4">{money(p.price)} <span className="text-base line-through text-[#9a9188]">{p.compareAt ? money(p.compareAt) : ""}</span></div>
            <p className="text-sm text-[#766d65] font-semibold mt-3 leading-6">{p.description}</p>
          </button>
        ))}
      </div>
      <div className="card p-7 mb-7"><h2 className="text-3xl font-black mb-1">Pick your meals</h2><p className="text-[#766d65] font-bold">Selected {items.reduce((a, i) => a + i.quantity, 0)} of {plan.meals}</p></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-28">
        {eligibleItems.map((item) => <div key={item.name} className="card p-5"><div className="h-40 rounded-3xl bg-kabob-cream grid place-items-center text-5xl">🍽️</div><h3 className="font-black text-xl mt-4 leading-6">{item.name}</h3><p className="text-sm font-bold text-[#766d65] mt-1">{item.category} • {money(item.price)}</p><button onClick={() => addItem(item)} className="btn-primary w-full mt-5">Add to order</button></div>)}
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 border-t border-kabob-sand p-4"><div className="mx-auto max-w-7xl flex justify-between items-center"><div className="font-black">{items.reduce((a, i) => a + i.quantity, 0)} meals selected</div><div className="flex items-center gap-4"><div className="text-2xl font-black text-kabob-green">{money(plan.price)}</div><button disabled={items.reduce((a, i) => a + i.quantity, 0) === 0} onClick={() => setCheckout(true)} className="btn-primary disabled:opacity-50">Continue</button></div></div></div>
    </section>
  );
}

function Rewards({ saveProfile, addMessage }: { saveProfile: (p: Profile, password: string) => Promise<Profile>; addMessage: (id: string, t: string, s: string, b: string) => Promise<void>; }) {
  const [created, setCreated] = useState<Profile | null>(null);
  async function submit(form: FormData) {
    const profile: Profile = { id: crypto.randomUUID(), role: "customer", full_name: String(form.get("name")), email: String(form.get("email")), phone: String(form.get("phone")), pin_code: String(form.get("pin")), date_of_birth: String(form.get("dob")), anniversary: String(form.get("anniversary") || ""), member_id: memberId(), created_at: nowIso() };
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
        <Field name="phone" label="Phone number" required />
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
      </div>
    </section>
  );
}

function TeamLogin({ login, activeRole }: { login: (e: string, p: string, r?: Role) => Promise<boolean>; activeRole: Role | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  if (activeRole === "staff") return <div className="card p-8 md:p-10 text-center max-w-[560px]"><h1 className="text-4xl font-black">Staff access</h1><a className="btn-primary mt-6" href="/staff">Open check-in</a></div>;
  if (activeRole === "owner") return <div className="card p-8 md:p-10 text-center max-w-[560px]"><h1 className="text-4xl font-black">Owner access</h1><a className="btn-primary mt-6" href="/owner">Open dashboard</a></div>;
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
      <div className="card p-8 md:p-10 grid lg:grid-cols-[1fr_320px] gap-10 items-start">
        <div>
          <h1 className="text-5xl font-black leading-tight">{customer.full_name}</h1>
          <p className="text-xl font-black mt-3 text-kabob-green">{customer.member_id}</p>
          <p className="font-bold text-[#74675d] mt-1">{customer.phone} • {customer.email}</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            <Metric label="Date of birth" value={formatDate(customer.date_of_birth)} />
            <Metric label="Anniversary" value={formatDate(customer.anniversary)} />
            <Metric label="Tier" value={pass?.tier || "Rewards only"} />
            <Metric label="Meals left" value={pass ? `${pass.meals_included - pass.meals_used}/${pass.meals_included}` : "—"} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <Metric label="Frequency" value={pass?.frequency || "—"} />
            <Metric label="Renewal" value={formatDate(pass?.renewal_date)} />
          </div>
        </div>
        <div className="card-soft p-6 text-center">
          <Image alt="Member QR" src={qrUrl(customer.member_id || customer.id)} width={260} height={260} className="mx-auto" />
          <div className="text-2xl font-black mt-4">{customer.member_id}</div>
        </div>
      </div>
      <History title="Previous orders" rows={orders.map((o)=>[new Date(o.created_at).toLocaleString(), o.order_type, money(o.total), o.payment_status])} headers={["Date","Type","Total","Status"]}/>
      <History title="Redemption activity" rows={reds.map((r)=>[new Date(r.created_at).toLocaleString(), r.item_name, String(r.meals_remaining ?? "")])} headers={["Date","Item","Remaining"]}/>
      <History title="Messages sent" rows={messages.map((m)=>[new Date(m.created_at).toLocaleString(), m.message_type, m.channel, m.status])} headers={["Date","Type","Channel","Status"]}/>
    </section>
  );
}

function Staff({ store, setStore, addMessage, logout }: { store: Store; setStore: React.Dispatch<React.SetStateAction<Store>>; addMessage: (id: string, t: string, s: string, b: string) => Promise<void>; logout: () => void }) {
  const customers = store.profiles.filter((p) => p.role === "customer");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(customers[0]?.id || "");
  const selected = customers.find((c) => c.id === selectedId) || customers[0];
  const pass = store.passes.find((p) => p.customer_id === selected?.id);
  const plan = mealPlans.find((p) => p.tier === pass?.tier) || mealPlans[2];
  const eligible = menuItems.filter((i) => plan.categories.includes(i.category));
  const [itemName, setItemName] = useState(eligible[0]?.name || "");
  const filtered = customers.filter((c) => [c.full_name, c.email, c.phone, c.member_id].join(" ").toLowerCase().includes(query.toLowerCase()));
  async function redeem() {
    if (!selected || !pass) return;
    if (pass.meals_used >= pass.meals_included) return alert("No meals left.");
    const item = menuItems.find((i) => i.name === itemName) || eligible[0];
    const remaining = pass.meals_included - pass.meals_used - 1;
    const red: Redemption = { id: crypto.randomUUID(), customer_id: selected.id, meal_pass_id: pass.id, staff_id: demoStaffId, item_name: item.name, category: item.category, meals_remaining: remaining, created_at: nowIso() };
    setStore((s) => ({ ...s, passes: s.passes.map((p) => p.id === pass.id ? { ...p, meals_used: p.meals_used + 1 } : p), redemptions: [red, ...s.redemptions] }));
    await addMessage(selected.id, "meal_redeemed", "Your meal pass was used", `${item.name} redeemed. ${remaining} meals remaining.`);
  }
  return <section><div className="flex justify-between items-center mb-8"><h1 className="text-5xl font-black">Staff check-in</h1><button onClick={logout} className="btn-secondary">Logout</button></div><div className="grid lg:grid-cols-[340px_1fr] gap-8"><div className="card p-5"><h2 className="text-2xl font-black mb-4">Search / scan</h2><input className="input mb-4" placeholder="Name, phone, email, member ID" value={query} onChange={(e)=>setQuery(e.target.value)} /><button className="btn-primary w-full mb-5" onClick={()=>setQuery("AKR-AA4QN")}>Scan QR</button><div className="space-y-3 max-h-[600px] overflow-auto">{filtered.map((c)=>{const p=store.passes.find(x=>x.customer_id===c.id);return <button key={c.id} onClick={()=>setSelectedId(c.id)} className="w-full text-left border border-kabob-sand rounded-2xl p-3 hover:bg-kabob-cream"><div className="font-black">{c.full_name}</div><div className="text-sm text-[#766d65]">{c.member_id} • {c.phone}</div><div className="font-black text-kabob-green">{p ? `${p.meals_included-p.meals_used}/${p.meals_included} meals left` : "Rewards only"}</div></button>})}</div></div>{selected && <div className="space-y-6"><div className="card p-8 grid lg:grid-cols-[1fr_260px] gap-8"><div><h2 className="text-3xl font-black">{selected.full_name}</h2><p className="font-bold mt-2 text-[#74675d]">{selected.member_id} • {selected.phone} • {selected.email}</p><div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-7"><Metric label="Date of birth" value={formatDate(selected.date_of_birth)}/><Metric label="Anniversary" value={formatDate(selected.anniversary)}/><Metric label="Tier" value={pass?.tier || "Rewards only"}/><Metric label="Meals left" value={pass ? `${pass.meals_included-pass.meals_used}/${pass.meals_included}` : "—"}/></div><h3 className="text-xl font-black mt-7 mb-3">Redeem meal</h3><select className="input mb-4" value={itemName} onChange={(e)=>setItemName(e.target.value)}>{eligible.map((i)=><option key={i.name}>{i.name}</option>)}</select><button className="btn-primary mr-3" onClick={redeem}>Redeem selected meal</button><button className="btn-secondary" onClick={()=>addMessage(selected.id,"balance","Your Afghan Kabob balance",`You have ${pass ? pass.meals_included-pass.meals_used : 0} meals remaining.`)}>Send balance</button></div><div className="text-center"><Image alt="QR" src={qrUrl(selected.member_id || selected.id)} width={230} height={230} className="mx-auto"/><div className="font-black mt-3">{selected.member_id}</div></div></div><CustomerTables customer={selected} store={store}/></div>}</div></section>;
}

function Owner({ store, setStore, logout }: { store: Store; setStore: React.Dispatch<React.SetStateAction<Store>>; logout: () => void }) {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState("Afghan Chicken Kabob");
  const customers = store.profiles.filter((p) => p.role === "customer" && [p.full_name,p.email,p.phone,p.member_id].join(" ").toLowerCase().includes(q.toLowerCase()));
  const redRows = store.redemptions.map((r)=>{const c=store.profiles.find(p=>p.id===r.customer_id); const st=store.profiles.find(p=>p.id===r.staff_id); return [new Date(r.created_at).toLocaleString(), c?.full_name||"", r.item_name, st?.full_name||"Staff", String(r.meals_remaining ?? "")];});
  return <section><div className="flex justify-between items-center mb-8"><h1 className="text-5xl font-black">Owner dashboard</h1><button onClick={logout} className="btn-secondary">Logout</button></div><div className="grid md:grid-cols-4 gap-4 mb-8"><Metric label="Customers" value={String(customers.length)}/><Metric label="Active passes" value={String(store.passes.filter(p=>p.status==='active').length)}/><Metric label="Redemptions" value={String(store.redemptions.length)}/><Metric label="Messages" value={String(store.messages.length)}/></div><div className="card p-6 mb-8"><div className="flex flex-col md:flex-row md:justify-between gap-4 mb-5"><h2 className="text-3xl font-black">Customer table</h2><input className="input md:max-w-sm" placeholder="Filter customers" value={q} onChange={(e)=>setQ(e.target.value)} /></div><div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>DOB</th><th>Anniversary</th><th>Tier</th><th>Meals left</th><th>Total spent</th></tr></thead><tbody>{customers.map((c)=>{const p=store.passes.find(x=>x.customer_id===c.id); const spent=store.orders.filter(o=>o.customer_id===c.id).reduce((a,o)=>a+o.total,0); return <tr key={c.id}><td className="font-black">{c.full_name}<br/><span className="text-xs text-[#766d65]">{c.member_id}</span></td><td>{c.email}</td><td>{c.phone}</td><td>{formatDate(c.date_of_birth)}</td><td>{formatDate(c.anniversary)}</td><td>{p?.tier || "Rewards"}</td><td>{p ? `${p.meals_included-p.meals_used}/${p.meals_included}` : "—"}</td><td>{money(spent)}</td></tr>})}</tbody></table></div></div><History title="Activity log" headers={["Date","Customer","Item","Redeemed by","Remaining"]} rows={redRows}/><div className="card p-6 mt-8"><h2 className="text-3xl font-black mb-5">Email / SMS outbox</h2><div className="table-wrap"><table><thead><tr><th>Date</th><th>Customer</th><th>Channel</th><th>Type</th><th>Subject</th><th>Status</th><th></th></tr></thead><tbody>{store.messages.map((m)=>{const c=store.profiles.find(p=>p.id===m.customer_id); return <tr key={m.id}><td>{new Date(m.created_at).toLocaleString()}</td><td>{c?.full_name}</td><td>{m.channel}</td><td>{m.message_type}</td><td>{m.subject}</td><td><span className="pill">{m.status}</span></td><td><button className="btn-secondary !py-2" onClick={()=>setStore(s=>({...s,messages:s.messages.map(x=>x.id===m.id?{...x,status:"resent",sent_at:nowIso()}:x)}))}>Resend</button></td></tr>})}</tbody></table></div></div><div className="card p-6 mt-8"><h2 className="text-3xl font-black mb-2">Menu & offer settings</h2><p className="text-[#74675d] font-semibold mb-5">Owner-only controls for menu items, prices, and images. This is wired for the dashboard UI now; production saves these changes to Supabase.</p><div className="grid md:grid-cols-3 gap-4"><label><span className="label">Menu item</span><select className="input" value={editing} onChange={(e)=>setEditing(e.target.value)}>{menuItems.map((i)=><option key={i.name}>{i.name}</option>)}</select></label><Field name="price" label="Price" /><Field name="image" label="Image URL" /></div><button className="btn-secondary mt-5">Save menu update</button></div></section>;
}

function CustomerTables({ customer, store }: { customer: Profile; store: Store }) {
  const orders = store.orders.filter((o)=>o.customer_id===customer.id);
  const reds = store.redemptions.filter((r)=>r.customer_id===customer.id);
  const msgs = store.messages.filter((m)=>m.customer_id===customer.id);
  return <div className="space-y-6"><History title="Previous orders" headers={["Date","Type","Total","Status"]} rows={orders.map((o)=>[new Date(o.created_at).toLocaleString(),o.order_type,money(o.total),o.payment_status])}/><History title="Previous redemptions" headers={["Date","Item","Category","Remaining"]} rows={reds.map((r)=>[new Date(r.created_at).toLocaleString(),r.item_name,r.category||"",String(r.meals_remaining ?? "")])}/><History title="Messages" headers={["Date","Type","Channel","Status"]} rows={msgs.map((m)=>[new Date(m.created_at).toLocaleString(),m.message_type,m.channel,m.status])}/></div>;
}

function Field({ name, label, type="text", required=false }: { name: string; label: string; type?: string; required?: boolean }) { return <label><span className="label">{label}{required ? " *" : ""}</span><input className="input" name={name} type={type} required={required}/></label>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="metric-card"><div className="metric-label">{label}</div><div className="metric-value">{value}</div></div>; }
function StepBar({ step }: { step: number }) { return <div className="flex items-center justify-center gap-3 mb-12 text-sm"><span className={step>=1?"step-pill step-active":"step-pill"}>1 Select a plan</span><span className="step-line"/><span className={step>=2?"step-pill step-active":"step-pill"}>2 Pick your meals</span><span className="step-line"/><span className={step>=3?"step-pill step-active":"step-pill"}>3 Submit order</span></div>; }
function OrderSummary({ plan, items }: { plan: ReturnType<typeof getPlan>; items: OrderItem[] }) { const tax=+(plan.price*.11).toFixed(2); return <aside className="card p-6 h-fit sticky top-5"><h2 className="text-2xl font-black">Your Order</h2><div className="mt-4 space-y-3">{items.map((i)=><div key={i.name} className="flex justify-between gap-4 font-bold"><span>{i.quantity}x {i.name}</span><span>{money(i.price*i.quantity)}</span></div>)}</div><div className="border-t border-kabob-sand mt-5 pt-5 space-y-2 font-bold"><div className="flex justify-between"><span>{plan.meals} meals/{plan.frequency}</span><span>{money(plan.price)}</span></div><div className="flex justify-between"><span>Tax estimate</span><span>{money(tax)}</span></div><div className="flex justify-between text-xl font-black text-kabob-green"><span>Total</span><span>{money(plan.price+tax)}</span></div></div></aside>; }
function History({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) { return <div className="card p-6"><h2 className="text-2xl font-black mb-4">{title}</h2><div className="table-wrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((r,idx)=><tr key={idx}>{r.map((c,i)=><td key={i}>{c}</td>)}</tr>) : <tr><td colSpan={headers.length}>No records yet.</td></tr>}</tbody></table></div></div>; }
