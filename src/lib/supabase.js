import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.");
}

export const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || "").trim().toLowerCase();
export const ADMIN_USERNAME = String(import.meta.env.VITE_ADMIN_USERNAME || "john").trim().toLowerCase();

export function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

export function usernameToAuthEmail(username) {
  const normalized = normalizeUsername(username);
  return normalized ? `${normalized}@users.whitecat.app` : "";
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
