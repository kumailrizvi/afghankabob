export type Role = "customer" | "staff" | "owner";

export type Profile = {
  id: string;
  role: Role;
  full_name: string;
  email: string;
  phone: string;
  date_of_birth?: string | null;
  anniversary?: string | null;
  member_id?: string | null;
  pin_code?: string | null;
  created_at?: string;
};

export type MealPass = {
  id: string;
  customer_id: string;
  frequency: string;
  tier: string;
  meals_included: number;
  meals_used: number;
  price: number;
  status: string;
  start_date?: string;
  renewal_date?: string | null;
};

export type Order = {
  id: string;
  customer_id: string;
  meal_pass_id?: string | null;
  order_type: "online" | "in_store";
  subtotal: number;
  tax: number;
  total: number;
  payment_status: string;
  created_at: string;
};

export type Redemption = {
  id: string;
  customer_id: string;
  meal_pass_id?: string | null;
  staff_id?: string | null;
  item_name: string;
  category?: string | null;
  meals_remaining?: number | null;
  created_at: string;
};

export type Message = {
  id: string;
  customer_id: string;
  channel: "email" | "sms";
  message_type: string;
  subject?: string | null;
  body: string;
  status: "queued" | "sent" | "failed" | "resent";
  provider_message_id?: string | null;
  sent_at?: string | null;
  created_at: string;
};
