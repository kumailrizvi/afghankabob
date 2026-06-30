export type Frequency = "daily" | "weekly" | "monthly";

export type MealPlan = {
  id: string;
  frequency: Frequency;
  tier: string;
  meals: number;
  price: number;
  compareAt?: number;
  categories: string[];
  description: string;
};

export const mealPlans: MealPlan[] = [
  { id: "daily-donair", frequency: "daily", tier: "Daily Donair", meals: 1, price: 14.99, compareAt: 17, categories: ["Donair", "Specials"], description: "One meal for today. Good for walk-ins and lunch." },
  { id: "weekly-value", frequency: "weekly", tier: "Weekly Value", meals: 3, price: 39.99, compareAt: 48, categories: ["Donair", "Kabob"], description: "Three meals per week for regular lunch customers." },
  { id: "weekly-classic", frequency: "weekly", tier: "Weekly Classic", meals: 5, price: 69.99, compareAt: 85, categories: ["Donair", "Kabob", "Specials"], description: "Five meals per week with kabob and specials included." },
  { id: "monthly-classic", frequency: "monthly", tier: "Monthly Classic", meals: 8, price: 109.99, compareAt: 136, categories: ["Donair", "Kabob", "Specials"], description: "Eight meals per month for regular customers." },
  { id: "monthly-family", frequency: "monthly", tier: "Monthly Family", meals: 12, price: 159.99, compareAt: 204, categories: ["Kabob", "Platters", "Specials"], description: "Family style monthly pass with platter eligibility." }
];

export const menuItems = [
  { name: "Tandoori Chicken Fry", category: "Kabob", price: 22 },
  { name: "Spicy Beef BBQ", category: "Kabob", price: 22 },
  { name: "Afghan Chicken Kabob", category: "Kabob", price: 22 },
  { name: "Afghan Beef Kabob", category: "Kabob", price: 22 },
  { name: "12” Jumbo Donair", category: "Donair", price: 14 },
  { name: "12” Super Jumbo Donair", category: "Donair", price: 17 },
  { name: "Donair Plate", category: "Donair", price: 18 },
  { name: "Lamb Shank", category: "Specials", price: 26 },
  { name: "Lamb Steak", category: "Specials", price: 26 },
  { name: "Loaded Fries", category: "Specials", price: 13 },
  { name: "Platter for 2", category: "Platters", price: 42 },
  { name: "Platter for 3", category: "Platters", price: 60 }
];

export function getPlan(planId: string) {
  return mealPlans.find((plan) => plan.id === planId) || mealPlans[2];
}
