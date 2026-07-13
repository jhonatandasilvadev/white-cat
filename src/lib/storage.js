import { getMonthKey } from "./finance.js";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function salaryKey(email, year, month) {
  return `salary_${email}_${year}_${getMonthKey(month)}`;
}

export function expensesKey(email, year, month) {
  return `expenses_${email}_${year}_${getMonthKey(month)}`;
}

export function getSalary(email, year, month) {
  const value = localStorage.getItem(salaryKey(email, year, month));
  return value === null || value === "" ? 0 : Number(value);
}

export function saveSalary(email, year, month, salary) {
  localStorage.setItem(salaryKey(email, year, month), String(Number(salary || 0)));
}

export function getExpenses(email, year, month) {
  return readJson(expensesKey(email, year, month), []);
}

export function saveExpenses(email, year, month, expenses) {
  writeJson(expensesKey(email, year, month), expenses);
}

export function getAllLocalFinanceMonths(email) {
  const prefix = `expenses_${email}_`;
  const months = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix)) continue;
    const period = key.slice(prefix.length).match(/^(\d{4})_(\d{2})$/);
    if (!period) continue;
    const year = Number(period[1]);
    const month = Number(period[2]);
    months.push({
      year,
      month,
      salary: getSalary(email, year, month),
      expenses: getExpenses(email, year, month),
    });
  }

  return months;
}
