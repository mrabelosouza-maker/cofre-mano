// Cálculos derivados dos lançamentos. Tudo puro — facilita testar e reusar.
import { todayISO, parseISO, daysBetween } from "./format.js";

export const signOf = (type) => (type === "deposit" ? 1 : type === "withdrawal" ? -1 : 0);

// Totais gerais.
export function totals(entries) {
  let deposit = 0, withdrawal = 0, spend = 0;
  for (const e of entries) {
    if (e.type === "deposit") deposit += e.amount;
    else if (e.type === "withdrawal") withdrawal += e.amount;
    else if (e.type === "spend") spend += e.amount;
  }
  const balance = deposit - withdrawal;
  // Taxa de poupança = poupado / (poupado + gasto) no período.
  const rate = deposit + spend > 0 ? deposit / (deposit + spend) : null;
  return { deposit, withdrawal, spend, balance, rate };
}

export const balanceOf = (entries) => totals(entries).balance;

// Série de saldo acumulado por data (apenas dias com movimento que afeta saldo).
export function balanceSeries(entries) {
  const byDate = new Map();
  for (const e of entries) {
    byDate.set(e.date, (byDate.get(e.date) || 0) + signOf(e.type) * e.amount);
  }
  const dates = [...byDate.keys()].sort();
  let acc = 0;
  return dates.map((d) => ({ date: d, balance: (acc += byDate.get(d)) }));
}

// Agrupa "enviado" (deposits) por grão: 'day' | 'week' | 'month'.
export function depositsByGrain(entries, grain) {
  const map = new Map();
  for (const e of entries) {
    if (e.type !== "deposit") continue;
    const key = grainKey(e.date, grain);
    map.set(key, (map.get(key) || 0) + e.amount);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, value]) => ({ key, value }));
}

// Enviado x Gasto por dia (para barras comparativas), últimos N dias com dado.
export function compareByDay(entries) {
  const map = new Map();
  for (const e of entries) {
    if (e.type === "withdrawal") continue;
    const rec = map.get(e.date) || { deposit: 0, spend: 0 };
    if (e.type === "deposit") rec.deposit += e.amount; else rec.spend += e.amount;
    map.set(e.date, rec);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, v]) => ({ date, ...v }));
}

function grainKey(iso, grain) {
  if (grain === "month") return iso.slice(0, 7);          // YYYY-MM
  if (grain === "week") {
    const d = parseISO(iso);
    const day = (d.getDay() + 6) % 7;                     // segunda = 0
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0, 10);                  // segunda-feira da semana
  }
  return iso;                                              // dia
}

// Média de poupança líquida por dia, considerando o intervalo coberto pelos lançamentos.
export function avgNetPerDay(entries) {
  if (!entries.length) return 0;
  const net = totals(entries).balance;
  const first = entries.reduce((m, e) => (e.date < m ? e.date : m), entries[0].date);
  const span = Math.max(1, daysBetween(first, todayISO()) + 1);
  return net / span;
}

// Poupança líquida feita só no mês corrente.
export function savedThisMonth(entries) {
  const ym = todayISO().slice(0, 7);
  return entries
    .filter((e) => e.date.slice(0, 7) === ym)
    .reduce((s, e) => s + signOf(e.type) * e.amount, 0);
}
