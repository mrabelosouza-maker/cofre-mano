// Simulador: quanto poupar por dia, projeção do mês e prazo para a meta.
import { totals, avgNetPerDay } from "./calc.js";
import {
  money, parseMoney, daysLeftInMonth, fmtDateShort,
  lastDayOfMonthISO, todayISO, shiftISO,
} from "./format.js";
import { renderProjection } from "./charts.js";

const $ = (id) => document.getElementById(id);

// (alvo − saldo) / dias restantes no mês.
export function perDayNeeded(balance, target, daysLeft) {
  if (!(target > 0) || daysLeft <= 0) return null;
  return Math.max(0, (target - balance) / daysLeft);
}

// Pontos da projeção: saldo de hoje crescendo `perDay` por dia até o fim do mês.
export function projectionPoints(balance, perDay, daysLeft) {
  const pts = [{ label: "hoje", value: balance }];
  let acc = balance;
  const start = todayISO();
  for (let i = 1; i <= daysLeft; i++) {
    acc += perDay;
    pts.push({ label: fmtDateShort(shiftISO(start, i)), value: acc });
  }
  return pts;
}

// Renderiza o simulador inteiro a partir do estado atual e dos campos.
export function renderSimulator(entries, settings, persist) {
  const t = totals(entries);
  const daysLeft = daysLeftInMonth();
  const lastDay = fmtDateShort(lastDayOfMonthISO());

  // 1) Meta do mês -> poupar por dia
  const target = parseMoney($("sim-target").value);
  const need = perDayNeeded(t.balance, target, daysLeft);
  if (need == null) {
    $("sim-perday").textContent = "—";
    $("sim-perday-hint").textContent = "Digite a meta para calcular.";
  } else if (need === 0) {
    $("sim-perday").textContent = "Meta batida! 🎉";
    $("sim-perday-hint").textContent = `Você já tem ${money(t.balance)} no cofre.`;
  } else {
    $("sim-perday").textContent = money(need);
    $("sim-perday-hint").textContent =
      `Faltam ${money(target - t.balance)} em ${daysLeft} dia(s), até ${lastDay}.`;
  }

  // 2) Poupar por dia -> fim do mês
  const perDay = parseMoney($("sim-perday-input").value) || 0;
  const projected = t.balance + perDay * daysLeft;
  $("sim-endmonth").textContent = money(projected);
  renderProjection(projectionPoints(t.balance, perDay, daysLeft));

  // 3) Meta de longo prazo -> prazo no ritmo médio
  const goal = parseMoney($("sim-goal").value);
  const avg = avgNetPerDay(entries);
  if (!(goal > 0)) {
    $("sim-eta").textContent = "—";
    $("sim-eta-hint").textContent = "Digite o objetivo para estimar o prazo.";
  } else if (t.balance >= goal) {
    $("sim-eta").textContent = "Já atingido! 🏆";
    $("sim-eta-hint").textContent = "";
  } else if (avg <= 0) {
    $("sim-eta").textContent = "—";
    $("sim-eta-hint").textContent = "Ritmo médio atual é zero ou negativo. Poupe mais para projetar.";
  } else {
    const days = Math.ceil((goal - t.balance) / avg);
    const meses = (days / 30).toFixed(1);
    $("sim-eta").textContent = `${days} dias`;
    $("sim-eta-hint").textContent =
      `≈ ${meses} meses (por volta de ${fmtDateShort(shiftISO(todayISO(), days))}), poupando ${money(avg)}/dia em média.`;
  }

  // Persiste metas para sincronizar entre os dois.
  if (persist) {
    const patch = {};
    if (target > 0 && target !== settings.monthlyTarget) patch.monthlyTarget = target;
    if (goal > 0 && goal !== settings.goal) patch.goal = goal;
    if (Object.keys(patch).length) persist(patch);
  }
}

// Pré-preenche os campos com as metas salvas.
export function hydrateSimulator(settings) {
  if (settings.monthlyTarget > 0 && !$("sim-target").value)
    $("sim-target").value = String(settings.monthlyTarget).replace(".", ",");
  if (settings.goal > 0 && !$("sim-goal").value)
    $("sim-goal").value = String(settings.goal).replace(".", ",");
}
