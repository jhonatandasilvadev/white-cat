export const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export const CATEGORIES = ["Moradia", "Transporte", "Alimentacao", "Internet", "Lazer", "Outros"];

export const STATUSES = ["aguardando", "pago", "atrasado"];

export const STATUS_LABELS = {
  aguardando: "Não pago",
  pago: "Pago",
  atrasado: "Atrasado",
};

export function formatMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function getBrasiliaDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
}

export function getCurrentTimeLabel() {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

export function formatMonthYear(year, month) {
  return `${MONTHS[month - 1]} ${year}`;
}

export function getMonthKey(month) {
  return String(month).padStart(2, "0");
}

export function getNextMonth(year, month) {
  if (month === 12) {
    return { year: year + 1, month: 1 };
  }
  return { year, month: month + 1 };
}

export function calculateSummary(salary, expenses) {
  const total = expenses.reduce((sum, expense) => sum + Number(expense.value || 0), 0);
  const balance = Number(salary || 0) - total;
  return {
    total,
    balance,
    dailyBalance: balance / 30,
  };
}

export function sortExpenses(expenses) {
  return [...expenses].sort((a, b) => {
    const aDue = a.dueDate === "" ? 99 : Number(a.dueDate);
    const bDue = b.dueDate === "" ? 99 : Number(b.dueDate);
    return aDue - bDue;
  });
}
