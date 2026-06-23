// Ofensiva (streak), medalhas e cofrinho SVG.
import { totals } from "./calc.js";
import { todayISO, shiftISO } from "./format.js";

// Conjunto de dias (ISO) com pelo menos um depósito.
function depositDays(entries) {
  return new Set(entries.filter((e) => e.type === "deposit").map((e) => e.date));
}

// Ofensiva atual: dias seguidos com depósito terminando hoje (com 1 dia de tolerância).
export function currentStreak(entries) {
  const days = depositDays(entries);
  if (!days.size) return 0;
  let cursor = todayISO();
  if (!days.has(cursor)) {
    const y = shiftISO(cursor, -1);
    if (days.has(y)) cursor = y; else return 0;
  }
  let n = 0;
  while (days.has(cursor)) { n++; cursor = shiftISO(cursor, -1); }
  return n;
}

// Maior sequência já alcançada (recorde).
export function recordStreak(entries) {
  const days = [...depositDays(entries)].sort();
  let best = 0, run = 0, prev = null;
  for (const d of days) {
    run = prev && shiftISO(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

// Catálogo de medalhas. Cada uma diz se está conquistada a partir das estatísticas.
export function medals(entries) {
  const t = totals(entries);
  const streak = recordStreak(entries);
  const ratePct = t.rate != null ? Math.round(t.rate * 100) : 0;
  const defs = [
    { ico: "🌱", name: "Primeiro passo", desc: "1º depósito", on: t.deposit > 0 },
    { ico: "💵", name: "R$ 100", desc: "Saldo de R$ 100", on: t.balance >= 100 },
    { ico: "💰", name: "R$ 500", desc: "Saldo de R$ 500", on: t.balance >= 500 },
    { ico: "🏦", name: "R$ 1.000", desc: "Saldo de R$ 1.000", on: t.balance >= 1000 },
    { ico: "💎", name: "R$ 5.000", desc: "Saldo de R$ 5.000", on: t.balance >= 5000 },
    { ico: "🔥", name: "Ofensiva 7", desc: "7 dias seguidos", on: streak >= 7 },
    { ico: "⚡", name: "Ofensiva 30", desc: "30 dias seguidos", on: streak >= 30 },
    { ico: "👑", name: "Ofensiva 100", desc: "100 dias seguidos", on: streak >= 100 },
    { ico: "🛡️", name: "Disciplinado", desc: "Poupou ≥ 70%", on: t.rate != null && ratePct >= 70 },
  ];
  return defs;
}

// Desenha o cofrinho com o "líquido" no nível do percentual (0..1).
export function renderPiggy(svgEl, pct) {
  const p = Math.max(0, Math.min(1, pct || 0));
  // viewBox 0 0 200 160. Corpo do porquinho ~ x[34..176] y[40..128].
  const bodyTop = 44, bodyBottom = 126;
  const fillTop = bodyBottom - (bodyBottom - bodyTop) * p;
  svgEl.innerHTML = `
    <defs>
      <clipPath id="bodyClip"><ellipse cx="106" cy="92" rx="66" ry="42"/></clipPath>
      <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5b9dff"/><stop offset="1" stop-color="#34d399"/>
      </linearGradient>
    </defs>
    <!-- corpo -->
    <ellipse cx="106" cy="92" rx="66" ry="42" fill="#1b2438" stroke="#2c3a59" stroke-width="2"/>
    <!-- líquido -->
    <g clip-path="url(#bodyClip)">
      <rect x="40" y="${fillTop.toFixed(1)}" width="132" height="${(bodyBottom - fillTop + 4).toFixed(1)}" fill="url(#liquid)" opacity="0.9"/>
      <ellipse cx="106" cy="${fillTop.toFixed(1)}" rx="66" ry="6" fill="#7fc3ff" opacity="0.5"/>
    </g>
    <!-- orelha -->
    <path d="M70 58 L86 44 L88 64 Z" fill="#26314a"/>
    <!-- focinho -->
    <ellipse cx="168" cy="92" rx="12" ry="16" fill="#26314a" stroke="#2c3a59" stroke-width="2"/>
    <circle cx="165" cy="88" r="2.4" fill="#0b0f1a"/><circle cx="165" cy="96" r="2.4" fill="#0b0f1a"/>
    <!-- olho -->
    <circle cx="120" cy="80" r="3.4" fill="#eaf0ff"/>
    <!-- fenda da moeda -->
    <rect x="92" y="52" width="34" height="5" rx="2.5" fill="#0b0f1a"/>
    <!-- patas -->
    <rect x="66" y="126" width="14" height="14" rx="4" fill="#26314a"/>
    <rect x="128" y="126" width="14" height="14" rx="4" fill="#26314a"/>
    <!-- rabinho -->
    <path d="M40 86 q-10 -2 -8 8 q2 8 10 4" fill="none" stroke="#26314a" stroke-width="3"/>
    <!-- moeda caindo -->
    <circle cx="109" cy="36" r="8" fill="#fbbf24" stroke="#d99a16" stroke-width="1.5"/>
    <text x="109" y="40" text-anchor="middle" font-size="9" fill="#7a5a08" font-weight="700">R$</text>
  `;
}
