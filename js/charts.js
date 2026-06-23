// Gráficos (Chart.js via CDN), com tema escuro coerente com o app.
import Chart from "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/auto/+esm";
import { money, moneyCompact, fmtDateShort } from "./format.js";
import { balanceSeries, depositsByGrain, compareByDay, totals } from "./calc.js";

const C = {
  text: "#93a0bd", grid: "rgba(38,49,73,.6)", green: "#34d399", blue: "#5b9dff",
  red: "#fb7185", greenFill: "rgba(52,211,153,.18)",
};

Chart.defaults.color = C.text;
Chart.defaults.font.family = '"Inter", system-ui, sans-serif';
Chart.defaults.font.size = 11;
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.plugins.legend.labels.boxHeight = 12;
Chart.defaults.plugins.tooltip.callbacks = {}; // por gráfico

const instances = {};
function mount(id, config) {
  const el = document.getElementById(id);
  if (!el) return;
  if (instances[id]) instances[id].destroy();
  instances[id] = new Chart(el, config);
}

const moneyTooltip = (label = "") => ({
  callbacks: { label: (ctx) => `${label || ctx.dataset.label || ""}: ${money(ctx.parsed.y ?? ctx.parsed)}` },
});
const yMoney = {
  ticks: { callback: (v) => moneyCompact(v) },
  grid: { color: C.grid }, border: { display: false },
};
const xCat = { grid: { display: false }, border: { display: false } };

function gradient(ctx, color) {
  const { ctx: c, chartArea } = ctx.chart;
  if (!chartArea) return color;
  const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  g.addColorStop(0, "rgba(52,211,153,.30)");
  g.addColorStop(1, "rgba(52,211,153,0)");
  return g;
}

export function renderBalance(entries, id = "chart-balance") {
  const s = balanceSeries(entries);
  mount(id, {
    type: "line",
    data: {
      labels: s.map((p) => fmtDateShort(p.date)),
      datasets: [{
        label: "Saldo", data: s.map((p) => p.balance),
        borderColor: C.green, borderWidth: 2.5,
        backgroundColor: (ctx) => gradient(ctx, C.green), fill: true,
        tension: 0.32, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: C.green,
      }],
    },
    options: {
      maintainAspectRatio: false, responsive: true,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false }, tooltip: moneyTooltip("Saldo") },
      scales: { x: xCat, y: yMoney },
    },
  });
}

export function renderBars(entries, grain, id = "chart-bars") {
  const d = depositsByGrain(entries, grain);
  const label = (k) => grain === "month" ? k.slice(5) + "/" + k.slice(2, 4) : fmtDateShort(k);
  mount(id, {
    type: "bar",
    data: {
      labels: d.map((x) => label(x.key)),
      datasets: [{ label: "Enviado", data: d.map((x) => x.value),
        backgroundColor: C.green, borderRadius: 6, maxBarThickness: 34 }],
    },
    options: {
      maintainAspectRatio: false, responsive: true,
      plugins: { legend: { display: false }, tooltip: moneyTooltip("Enviado") },
      scales: { x: xCat, y: yMoney },
    },
  });
}

export function renderCompare(entries, id = "chart-compare") {
  const d = compareByDay(entries).slice(-14);
  mount(id, {
    type: "bar",
    data: {
      labels: d.map((x) => fmtDateShort(x.date)),
      datasets: [
        { label: "Enviado", data: d.map((x) => x.deposit), backgroundColor: C.green, borderRadius: 5, maxBarThickness: 18 },
        { label: "Gasto", data: d.map((x) => x.spend), backgroundColor: C.red, borderRadius: 5, maxBarThickness: 18 },
      ],
    },
    options: {
      maintainAspectRatio: false, responsive: true,
      plugins: { legend: { position: "bottom" }, tooltip: moneyTooltip() },
      scales: { x: xCat, y: yMoney },
    },
  });
}

export function renderDonut(entries, id = "chart-donut") {
  const t = totals(entries);
  mount(id, {
    type: "doughnut",
    data: {
      labels: ["Poupado", "Gasto"],
      datasets: [{ data: [t.deposit, t.spend], backgroundColor: [C.green, C.red],
        borderColor: "#151c2e", borderWidth: 3, hoverOffset: 6 }],
    },
    options: {
      maintainAspectRatio: false, responsive: true, cutout: "62%",
      plugins: {
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${money(ctx.parsed)}` } },
      },
    },
  });
}

export function renderProjection(points, id = "chart-projection") {
  mount(id, {
    type: "line",
    data: {
      labels: points.map((p) => p.label),
      datasets: [{
        label: "Projeção", data: points.map((p) => p.value),
        borderColor: C.blue, borderWidth: 2.5, borderDash: [5, 4],
        backgroundColor: "rgba(91,157,255,.12)", fill: true, tension: 0.2,
        pointRadius: 0, pointHoverRadius: 4,
      }],
    },
    options: {
      maintainAspectRatio: false, responsive: true,
      plugins: { legend: { display: false }, tooltip: moneyTooltip("Saldo projetado") },
      scales: { x: xCat, y: yMoney },
    },
  });
}
