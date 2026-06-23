// Formatação de moeda (BRL) e datas (pt-BR), além de parsing de valores digitados.

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1,
});

export const money = (n) => brl.format(Number.isFinite(n) ? n : 0);
export const moneyCompact = (n) => brlCompact.format(Number.isFinite(n) ? n : 0);

// Converte texto digitado ("1.234,56", "1234.56", "1234") em número.
export function parseMoney(str) {
  if (typeof str === "number") return str;
  if (!str) return NaN;
  let s = String(str).trim().replace(/[R$\s]/g, "");
  if (s.includes(",")) {
    // formato pt-BR: ponto é milhar, vírgula é decimal
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

// Datas no formato YYYY-MM-DD, SEMPRE em horário local (evita o bug de virar o dia
// em fusos negativos quando se usa toISOString/UTC).
export function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const todayISO = () => isoLocal(new Date());

export function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Soma (ou subtrai) dias a uma data ISO, mantendo o horário local.
export function shiftISO(iso, deltaDays) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + deltaDays);
  return isoLocal(d);
}

const dfShort = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const dfFull = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
export const fmtDateShort = (iso) => dfShort.format(parseISO(iso)).replace(".", "");
export const fmtDateFull = (iso) => dfFull.format(parseISO(iso));

export function daysBetween(aISO, bISO) {
  return Math.round((parseISO(bISO) - parseISO(aISO)) / 86400000);
}

// Quantos dias faltam até o fim do mês atual (incluindo hoje).
export function daysLeftInMonth(fromISO = todayISO()) {
  const d = parseISO(fromISO);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return last - d.getDate() + 1;
}

export function lastDayOfMonthISO(fromISO = todayISO()) {
  const d = parseISO(fromISO);
  return isoLocal(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
