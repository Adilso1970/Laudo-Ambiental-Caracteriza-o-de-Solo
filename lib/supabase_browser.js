import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMBEDDED_SUPABASE_URL = "https://enthwpzurpadquvejrqw.supabase.co";
const EMBEDDED_SUPABASE_KEY = "sb_publishable_4gg2xxm_WX0U5jqBAPcZlw_073_DbWi";

function firstFilled(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function readMeta(name) {
  const el = document.querySelector(`meta[name="${name}"]`);
  return el?.content?.trim?.() || "";
}

function resolveConfig() {
  const g = window;

  const url = firstFilled(
    g.__NB_SUPABASE_URL__,
    g.__SUPABASE_URL__,
    g.SUPABASE_URL,
    g.__APP_SUPABASE_URL__,
    localStorage.getItem("NB_SUPABASE_URL"),
    localStorage.getItem("SUPABASE_URL"),
    readMeta("supabase-url"),
    EMBEDDED_SUPABASE_URL
  );

  const key = firstFilled(
    g.__NB_SUPABASE_PUBLISHABLE_KEY__,
    g.__NB_SUPABASE_ANON_KEY__,
    g.__SUPABASE_PUBLISHABLE_KEY__,
    g.__SUPABASE_ANON_KEY__,
    g.SUPABASE_PUBLISHABLE_KEY,
    g.SUPABASE_ANON_KEY,
    g.__APP_SUPABASE_KEY__,
    localStorage.getItem("NB_SUPABASE_PUBLISHABLE_KEY"),
    localStorage.getItem("NB_SUPABASE_ANON_KEY"),
    localStorage.getItem("SUPABASE_PUBLISHABLE_KEY"),
    localStorage.getItem("SUPABASE_ANON_KEY"),
    readMeta("supabase-publishable-key"),
    readMeta("supabase-anon-key"),
    EMBEDDED_SUPABASE_KEY
  );

  return { url, key };
}

let supabaseClientInstance = null;

export function getSupabaseClient() {
  if (window.__NB_SUPABASE_CLIENT__) {
    return window.__NB_SUPABASE_CLIENT__;
  }

  if (supabaseClientInstance) {
    return supabaseClientInstance;
  }

  const { url, key } = resolveConfig();

  if (!url || !key) {
    throw new Error("Configuração do Supabase não encontrada no frontend.");
  }

  supabaseClientInstance = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  window.__NB_SUPABASE_CLIENT__ = supabaseClientInstance;
  return supabaseClientInstance;
}