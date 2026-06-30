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

-- Demo rows for quick testing in Supabase table view.
insert into profiles (id, role, full_name, email, phone, date_of_birth, anniversary, member_id, pin_code)
values
('00000000-0000-0000-0000-000000000101','customer','Kumail Rizvi','kumail@example.com','3065557788','1998-07-10','2026-12-05','AKR-AA4QN','1234'),
('00000000-0000-0000-0000-000000000102','customer','Sara Ahmed','sara@example.com','3065551122','1996-08-14','2026-10-01','AKR-XZXVM','2222'),
('00000000-0000-0000-0000-000000000201','staff','Staff User','staff@afghankabob.ca','',null,null,null,null),
('00000000-0000-0000-0000-000000000301','owner','Owner User','owner@afghankabob.ca','',null,null,null,null)
on conflict (id) do nothing;

insert into meal_passes (customer_id, frequency, tier, meals_included, meals_used, price, status, renewal_date)
values
('00000000-0000-0000-0000-000000000101','monthly','Monthly Classic',8,1,109.99,'active', current_date + interval '30 days'),
('00000000-0000-0000-0000-000000000102','weekly','Weekly Value',3,1,39.99,'active', current_date + interval '7 days');
