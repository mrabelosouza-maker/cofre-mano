// ============================================================
// Camada de dados única, com dois adaptadores:
//   - demo:     localStorage (sem configuração; roda na hora)
//   - supabase: nuvem com sync em tempo real
// A interface pública é a mesma nos dois modos.
// ============================================================
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { isoLocal } from "./format.js";

const HAS_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const LS_ENTRIES = "cofre.entries";
const LS_SETTINGS = "cofre.settings";
const LS_SEEDED = "cofre.seeded";

const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

const uid = () =>
  (crypto.randomUUID && crypto.randomUUID()) ||
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

// ------------------------------------------------------------
// Adaptador DEMO (localStorage)
// ------------------------------------------------------------
const demo = {
  _read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  _write(key, val) { localStorage.setItem(key, JSON.stringify(val)); },

  async list() {
    return this._read(LS_ENTRIES, []).slice().sort(byDate);
  },
  async add(e) {
    const entries = this._read(LS_ENTRIES, []);
    const row = { id: uid(), created_at: new Date().toISOString(), ...e };
    entries.push(row);
    this._write(LS_ENTRIES, entries);
    notify();
    return row;
  },
  async remove(id) {
    this._write(LS_ENTRIES, this._read(LS_ENTRIES, []).filter((e) => e.id !== id));
    notify();
  },
  async getSettings() {
    return this._read(LS_SETTINGS, { monthlyTarget: 0, goal: 0 });
  },
  async setSettings(patch) {
    const next = { ...(await this.getSettings()), ...patch };
    this._write(LS_SETTINGS, next);
    notify();
    return next;
  },
};

// ------------------------------------------------------------
// Adaptador SUPABASE
// ------------------------------------------------------------
let sb = null;        // client
let household = null; // { id, monthly_target, goal_amount }

const supa = {
  async list() {
    const { data, error } = await sb
      .from("entries").select("*")
      .eq("household_id", household.id)
      .order("date", { ascending: true });
    if (error) throw error;
    return (data || []).map(normalize).sort(byDate);
  },
  async add(e) {
    const { data, error } = await sb.from("entries").insert({
      household_id: household.id,
      date: e.date, type: e.type, amount: e.amount, note: e.note || null,
    }).select().single();
    if (error) throw error;
    notify();
    return normalize(data);
  },
  async remove(id) {
    const { error } = await sb.from("entries").delete().eq("id", id);
    if (error) throw error;
    notify();
  },
  async getSettings() {
    return { monthlyTarget: Number(household.monthly_target) || 0, goal: Number(household.goal_amount) || 0 };
  },
  async setSettings(patch) {
    const upd = {};
    if ("monthlyTarget" in patch) upd.monthly_target = patch.monthlyTarget;
    if ("goal" in patch) upd.goal_amount = patch.goal;
    const { data, error } = await sb
      .from("households").update(upd).eq("id", household.id).select().single();
    if (error) throw error;
    household = data;
    notify();
    return { monthlyTarget: Number(data.monthly_target) || 0, goal: Number(data.goal_amount) || 0 };
  },
};

function normalize(row) {
  return { id: row.id, date: row.date, type: row.type, amount: Number(row.amount), note: row.note, created_at: row.created_at };
}
function byDate(a, b) {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.created_at < b.created_at ? -1 : 1);
}

// ------------------------------------------------------------
// Store público
// ------------------------------------------------------------
export const store = {
  mode: HAS_SUPABASE ? "supabase" : "demo",
  user: null,
  _a: demo, // adaptador ativo

  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  // Inicializa. Retorna { needsAuth } — no modo Supabase pede login se não houver sessão.
  async init() {
    if (this.mode === "demo") {
      maybeSeedDemo();
      this._a = demo;
      return { needsAuth: false };
    }
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await sb.auth.getSession();
    if (!data.session) return { needsAuth: true };
    await this._afterAuth(data.session.user);
    return { needsAuth: false };
  },

  async signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await this._afterAuth(data.user);
  },

  async signUp(email, password) {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.session) {
      // Confirmação por e-mail ainda ligada no Supabase.
      throw new Error("Conta criada, mas falta confirmar por e-mail. Peça pra desligar 'Confirm email' no Supabase e tente Entrar.");
    }
    await this._afterAuth(data.user);
  },

  async signOut() {
    if (sb) await sb.auth.signOut();
    window.location.reload();
  },

  async _afterAuth(user) {
    this.user = user;
    // Descobre o cofre do usuário (RLS garante que só vê o próprio).
    const { data: hh, error } = await sb
      .from("households").select("*").limit(1).single();
    if (error) throw new Error("Seu e-mail ainda não está vinculado a um cofre. Rode o schema.sql com seu e-mail.");
    household = hh;
    this._a = supa;
    // Realtime: qualquer mudança nos lançamentos re-renderiza os dois aparelhos.
    sb.channel("entries-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "entries" }, notify)
      .subscribe();
  },

  // --- API de dados (delegam para o adaptador ativo) ---
  list()              { return this._a.list(); },
  add(entry)          { return this._a.add(entry); },
  remove(id)          { return this._a.remove(id); },
  getSettings()       { return this._a.getSettings(); },
  setSettings(patch)  { return this._a.setSettings(patch); },

  resetDemo() {
    localStorage.removeItem(LS_ENTRIES);
    localStorage.removeItem(LS_SETTINGS);
    localStorage.removeItem(LS_SEEDED);
    notify();
  },
};

// ------------------------------------------------------------
// Dados de exemplo (somente modo demo, só na primeira vez)
// ------------------------------------------------------------
function maybeSeedDemo() {
  if (localStorage.getItem(LS_SEEDED)) return;
  if ((demo._read(LS_ENTRIES, []) || []).length) return;

  const entries = [];
  const today = new Date();
  for (let i = 24; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const iso = isoLocal(d);
    const dow = d.getDay();
    // Depósito quase todo dia (renda do dia), valores variados.
    if (dow !== 0) {
      const base = 60 + Math.round(Math.random() * 90);
      entries.push({ id: uid(), date: iso, type: "deposit", amount: base, note: "diária", created_at: d.toISOString() });
    }
    // Gastos ocasionais.
    if (Math.random() < 0.5) {
      entries.push({ id: uid(), date: iso, type: "spend", amount: 20 + Math.round(Math.random() * 50), note: "mercado", created_at: d.toISOString() });
    }
  }
  // Uma devolução no meio do período.
  const mid = new Date(today); mid.setDate(mid.getDate() - 10);
  entries.push({ id: uid(), date: isoLocal(mid), type: "withdrawal", amount: 150, note: "imprevisto", created_at: mid.toISOString() });

  demo._write(LS_ENTRIES, entries);
  demo._write(LS_SETTINGS, { monthlyTarget: 2500, goal: 10000 });
  localStorage.setItem(LS_SEEDED, "1");
}

// Disponibiliza para depuração no console.
window.__cofre = store;
