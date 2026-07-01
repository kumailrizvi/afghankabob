create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('customer', 'staff', 'owner')),
  full_name text not null,
  email text not null,
  phone text,
  date_of_birth date,
  anniversary date,
  member_id text unique,
  pin_code text,
  created_at timestamp with time zone default now()
);

create table if not exists meal_passes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references profiles(id) on delete cascade,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  tier text not null,
  meals_included int not null,
  meals_used int not null default 0,
  price numeric not null,
  status text not null default 'active',
  start_date date default current_date,
  renewal_date date,
  created_at timestamp with time zone default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references profiles(id) on delete cascade,
  meal_pass_id uuid references meal_passes(id),
  order_type text not null check (order_type in ('online', 'in_store')),
  subtotal numeric not null,
  tax numeric not null default 0,
  total numeric not null,
  payment_status text not null default 'pending',
  created_at timestamp with time zone default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  item_name text not null,
  category text not null,
  price numeric not null,
  quantity int not null default 1
);

create table if not exists redemptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references profiles(id) on delete cascade,
  meal_pass_id uuid references meal_passes(id),
  staff_id uuid references profiles(id),
  item_name text not null,
  category text,
  meals_remaining int,
  created_at timestamp with time zone default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references profiles(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  message_type text not null,
  subject text,
  body text not null,
  status text not null default 'queued',
  provider_message_id text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create index if not exists profiles_email_idx on profiles(email);
create index if not exists profiles_member_idx on profiles(member_id);
create index if not exists redemptions_customer_idx on redemptions(customer_id);
create index if not exists messages_customer_idx on messages(customer_id);

-- Owner-editable menu listings used by the owner dashboard.
create table if not exists menu_items (
  name text primary key,
  category text not null,
  price numeric not null,
  image_url text,
  active boolean not null default true,
  updated_at timestamp with time zone default now()
);

insert into menu_items (name, category, price, image_url)
values
('Tandoori Chicken Fry','Kabob',22,null),
('Spicy Beef BBQ','Kabob',22,null),
('Afghan Chicken Kabob','Kabob',22,null),
('Afghan Beef Kabob','Kabob',22,null),
('12” Jumbo Donair','Donair',14,null),
('12” Super Jumbo Donair','Donair',17,null),
('Donair Plate','Donair',18,null),
('Lamb Shank','Specials',26,null),
('Lamb Steak','Specials',26,null),
('Loaded Fries','Specials',13,null),
('Platter for 2','Platters',42,null),
('Platter for 3','Platters',60,null)
on conflict (name) do nothing;

create table if not exists offer_settings (
  id text primary key default 'default',
  birthday_discount numeric not null default 10,
  anniversary_discount numeric not null default 10,
  updated_at timestamp with time zone default now()
);

insert into offer_settings (id, birthday_discount, anniversary_discount)
values ('default', 10, 10)
on conflict (id) do nothing;

alter table public.menu_items enable row level security;
alter table public.offer_settings enable row level security;

drop policy if exists "menu_items_read_authenticated" on public.menu_items;
create policy "menu_items_read_authenticated" on public.menu_items
for select to authenticated using (true);

drop policy if exists "menu_items_write_authenticated" on public.menu_items;
create policy "menu_items_write_authenticated" on public.menu_items
for all to authenticated using (true) with check (true);

drop policy if exists "offer_settings_read_authenticated" on public.offer_settings;
create policy "offer_settings_read_authenticated" on public.offer_settings
for select to authenticated using (true);

drop policy if exists "offer_settings_write_authenticated" on public.offer_settings;
create policy "offer_settings_write_authenticated" on public.offer_settings
for all to authenticated using (true) with check (true);

-- v7: audit/change log for menu, offer, and staff/owner changes.
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  actor_name text not null,
  action text not null,
  entity_type text not null,
  entity_name text not null,
  before_value text,
  after_value text,
  created_at timestamp with time zone default now()
);

create index if not exists audit_logs_created_idx on audit_logs(created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_read_authenticated" on public.audit_logs;
create policy "audit_logs_read_authenticated" on public.audit_logs
for select to authenticated using (true);

drop policy if exists "audit_logs_insert_authenticated" on public.audit_logs;
create policy "audit_logs_insert_authenticated" on public.audit_logs
for insert to authenticated with check (true);
