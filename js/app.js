// Orquestrador: navegação, autenticação, formulário e renderização das telas.
import { store } from "./data.js";
import { totals } from "./calc.js";
import {
  money, todayISO, fmtDateFull, fmtDateShort, parseMoney,
} from "./format.js";
import { renderBalance, renderBars, renderCompare, renderDonut } from "./charts.js";
import { renderSimulator, hydrateSimulator } from "./simulator.js";
import {
  currentStreak, recordStreak, medals, renderPiggy,
} from "./gamification.js";

const $ = (id) => document.getElementById(id);
const $$ = (sel) => [...document.querySelectorAll(sel)];

let entries = [];
let settings = { monthlyTarget: 0, goal: 0 };
let currentView = "painel";
let barsGrain = "day";

const TYPE_META = {
  deposit:    { ico: "⬆️", title: "Enviou pra poupar", sign: 1 },
  withdrawal: { ico: "⬇️", title: "Devolução", sign: -1 },
  spend:      { ico: "🛒", title: "Gasto", sign: 0 },
};
const VIEWS = ["painel", "lancar", "graficos", "simulador", "conquistas"];

// ---------------- Toast ----------------
let toastTimer;
function toast(msg, kind = "ok") {
  const el = $("toast");
  el.textContent = msg;
  el.className = `toast is-show is-${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = "toast"), 2600);
}

// ---------------- Navegação ----------------
function goto(view) {
  if (!VIEWS.includes(view)) view = "painel";
  currentView = view;
  if (location.hash !== `#${view}`) history.replaceState(null, "", `#${view}`);
  $$(".view").forEach((v) => (v.hidden = v.dataset.view !== view));
  $$(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.view === view));
  window.scrollTo(0, 0);
  renderCurrent();
}

// ---------------- Render geral ----------------
async function refresh() {
  [entries, settings] = await Promise.all([store.list(), store.getSettings()]);
  renderHeaderCommon();
  renderCurrent();
}

function renderHeaderCommon() {
  const t = totals(entries);
  $("hero-balance").textContent = money(t.balance);
  $("streak-days").textContent = currentStreak(entries);
  $("streak-label").textContent = currentStreak(entries) === 1 ? "dia seguido poupando" : "dias seguidos poupando";
}

function renderCurrent() {
  if (currentView === "painel") renderPainel();
  else if (currentView === "lancar") renderLista($("full-list"), entries, true);
  else if (currentView === "graficos") renderGraficos();
  else if (currentView === "simulador") {
    hydrateSimulator(settings);
    renderSimulator(entries, settings, persistSettings);
  } else if (currentView === "conquistas") renderConquistas();
}

// ---------------- Painel ----------------
function renderPainel() {
  const t = totals(entries);
  const streak = currentStreak(entries);
  $("hero-balance").textContent = money(t.balance);
  $("streak-days").textContent = streak;
  $("streak-label").textContent = streak === 1 ? "dia seguido poupando" : "dias seguidos poupando";
  $("kpi-deposit").textContent = money(t.deposit);
  $("kpi-withdraw").textContent = money(t.withdrawal);
  $("kpi-spend").textContent = money(t.spend);
  $("kpi-rate").textContent = t.rate == null ? "—" : `${Math.round(t.rate * 100)}%`;
  renderBalance(entries, "chart-balance-mini");
  renderLista($("recent-list"), entries.slice(-6).reverse(), false);
}

// ---------------- Lista de lançamentos ----------------
function renderLista(ulEl, items, withDelete) {
  if (!items.length) {
    ulEl.innerHTML = `<li class="empty">Nenhum lançamento ainda. Toque em “Lançar” para começar.</li>`;
    return;
  }
  const ordered = withDelete ? items.slice().reverse() : items;
  ulEl.innerHTML = ordered.map((e) => {
    const m = TYPE_META[e.type];
    const cls = m.sign > 0 ? "is-pos" : m.sign < 0 ? "is-neg" : "";
    const prefix = m.sign > 0 ? "+" : m.sign < 0 ? "−" : "";
    const note = e.note ? ` · ${escapeHtml(e.note)}` : "";
    return `<li class="entry entry--${e.type}">
      <div class="entry__ico">${m.ico}</div>
      <div class="entry__body">
        <div class="entry__title">${m.title}</div>
        <div class="entry__sub">${fmtDateShort(e.date)}${note}</div>
      </div>
      <div class="entry__amount ${cls}">${prefix}${money(e.amount)}</div>
      ${withDelete ? `<button class="entry__del" data-del="${e.id}" title="Excluir">✕</button>` : ""}
    </li>`;
  }).join("");

  if (withDelete) {
    ulEl.querySelectorAll("[data-del]").forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm("Excluir este lançamento?")) return;
        await store.remove(btn.dataset.del);
        toast("Lançamento excluído");
      };
    });
  }
}

// ---------------- Gráficos ----------------
function renderGraficos() {
  renderBalance(entries, "chart-balance");
  renderBars(entries, barsGrain, "chart-bars");
  renderCompare(entries, "chart-compare");
  renderDonut(entries, "chart-donut");
}

// ---------------- Conquistas ----------------
function renderConquistas() {
  const t = totals(entries);
  const goal = settings.goal > 0 ? settings.goal : Math.max(1000, Math.ceil(t.balance / 1000) * 1000 || 1000);
  const pct = goal > 0 ? t.balance / goal : 0;
  renderPiggy($("piggy-svg"), pct);
  $("piggy-pct").textContent = `${Math.round(Math.min(100, pct * 100))}%`;
  $("piggy-bar").style.width = `${Math.min(100, pct * 100)}%`;
  $("piggy-now").textContent = money(t.balance);
  $("piggy-goal").textContent = money(goal);

  const streak = currentStreak(entries);
  $("streak-big-days").textContent = streak;
  $("streak-big-label").textContent = streak === 1 ? "dia" : "dias";
  $("streak-record").textContent = recordStreak(entries);

  $("medals").innerHTML = medals(entries).map((m) => `
    <div class="medal ${m.on ? "is-on" : ""}">
      <div class="medal__ico">${m.ico}</div>
      <div class="medal__name">${m.name}</div>
      <div class="medal__desc">${m.desc}</div>
    </div>`).join("");
}

// ---------------- Formulário de lançamento ----------------
function setupForm() {
  $("entry-date").value = todayISO();

  $$("#entry-form .seg__btn").forEach((btn) => {
    btn.onclick = () => {
      $$("#entry-form .seg__btn").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      $("entry-type").value = btn.dataset.type;
    };
  });

  $("entry-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const amount = parseMoney($("entry-amount").value);
    const msg = $("entry-msg");
    if (!(amount > 0)) {
      msg.textContent = "Informe um valor válido.";
      msg.className = "form-msg is-err";
      return;
    }
    const entry = {
      type: $("entry-type").value,
      amount: Math.round(amount * 100) / 100,
      date: $("entry-date").value || todayISO(),
      note: $("entry-note").value.trim(),
    };
    try {
      await store.add(entry);
      $("entry-amount").value = "";
      $("entry-note").value = "";
      msg.textContent = "";
      msg.className = "form-msg";
      toast(`${TYPE_META[entry.type].title}: ${money(entry.amount)} ✓`);
    } catch (err) {
      msg.textContent = "Erro ao salvar: " + (err.message || err);
      msg.className = "form-msg is-err";
    }
  });
}

// ---------------- Simulador (eventos) ----------------
function setupSimulator() {
  ["sim-target", "sim-perday-input", "sim-goal"].forEach((id) => {
    $(id).addEventListener("input", () => renderSimulator(entries, settings, persistSettings));
  });
}
let persistTimer;
function persistSettings(patch) {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => store.setSettings(patch).then((s) => (settings = s)), 600);
}

// ---------------- Auth (Supabase) ----------------
function setupAuth() {
  const submit = async (mode) => {
    const email = $("auth-email").value.trim();
    const password = $("auth-password").value;
    const msg = $("auth-msg");
    if (!email || password.length < 6) {
      msg.textContent = "Informe e-mail e senha (mín. 6 caracteres).";
      msg.className = "auth-msg is-err";
      return;
    }
    msg.textContent = mode === "signup" ? "Criando conta…" : "Entrando…";
    msg.className = "auth-msg";
    try {
      if (mode === "signup") await store.signUp(email, password);
      else await store.signIn(email, password);
      showApp();
      await refresh();
      goto("painel");
    } catch (err) {
      msg.textContent = friendlyAuthError(err);
      msg.className = "auth-msg is-err";
    }
  };
  $("auth-form").addEventListener("submit", (ev) => { ev.preventDefault(); submit("signin"); });
  $("btn-signup").addEventListener("click", () => submit("signup"));
  $("btn-signout").onclick = () => store.signOut();
}

function friendlyAuthError(err) {
  const m = (err.message || String(err)).toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos. Primeira vez? Toque em “Criar conta”.";
  if (m.includes("already registered") || m.includes("user already")) return "Esse e-mail já tem conta. Toque em “Entrar”.";
  if (m.includes("signups not allowed") || m.includes("not allowed")) return "Cadastro desativado no Supabase (Authentication → Providers → Email).";
  if (m.includes("vinculado a um cofre")) return "Esse e-mail não está liberado no cofre. Confira se digitou o e-mail cadastrado.";
  return "Erro: " + (err.message || err);
}

function showApp() {
  $("auth-overlay").hidden = true;
  $("app").hidden = false;
  const badge = $("mode-badge");
  if (store.mode === "supabase") {
    badge.textContent = "Sincronizado";
    badge.classList.add("badge--live");
    $("btn-signout").hidden = false;
  } else {
    badge.textContent = "Modo demo";
  }
}

function showAuth() {
  $("auth-overlay").hidden = false;
  $("app").hidden = true;
}

// ---------------- Util ----------------
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------------- Bootstrap ----------------
async function main() {
  // Navegação
  $$(".tab").forEach((t) => (t.onclick = () => goto(t.dataset.view)));
  $$("[data-goto]").forEach((b) => (b.onclick = () => goto(b.dataset.goto)));
  $$("#view-graficos .seg--sm .seg__btn").forEach((btn) => {
    btn.onclick = () => {
      $$("#view-graficos .seg--sm .seg__btn").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      barsGrain = btn.dataset.grain;
      renderBars(entries, barsGrain, "chart-bars");
    };
  });

  setupForm();
  setupSimulator();
  setupAuth();

  // Re-renderiza quando os dados mudam (inclui realtime do Supabase).
  store.subscribe(() => refresh());

  try {
    const { needsAuth } = await store.init();
    if (needsAuth) { showAuth(); return; }
    showApp();
    await refresh();
    goto(VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "painel");
  } catch (err) {
    showAuth();
    $("auth-msg").textContent = "Erro de inicialização: " + (err.message || err);
    $("auth-msg").className = "auth-msg is-err";
  }
}

main();
