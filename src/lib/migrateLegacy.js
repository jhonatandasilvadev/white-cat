import { abril2026Expenses, abril2026Salary } from "../data/seedAbril2026.js";
import { expensesKey, getExpenses, salaryKey, saveExpenses, saveSalary } from "./storage.js";

export function migrateLegacyApril(email) {
  const legacyExpensesKey = `expenses_${email}`;
  const legacySalaryKey = `salary_${email}`;
  const aprilExpensesKey = expensesKey(email, 2026, 4);
  const aprilSalaryKey = salaryKey(email, 2026, 4);

  if (localStorage.getItem(legacyExpensesKey) && !localStorage.getItem(aprilExpensesKey)) {
    try {
      saveExpenses(email, 2026, 4, JSON.parse(localStorage.getItem(legacyExpensesKey)));
    } catch {
      saveExpenses(email, 2026, 4, []);
    }
  }

  if (localStorage.getItem(legacySalaryKey) && !localStorage.getItem(aprilSalaryKey)) {
    saveSalary(email, 2026, 4, Number(localStorage.getItem(legacySalaryKey) || 0));
  }
}

export function seedAprilIfNeeded(email) {
  const flag = `finance_seed_abril_2026_applied_${email}`;
  const expenses = getExpenses(email, 2026, 4);

  if (!localStorage.getItem(flag) && expenses.length === 0) {
    saveSalary(email, 2026, 4, abril2026Salary);
    saveExpenses(email, 2026, 4, abril2026Expenses);
    localStorage.setItem(flag, "true");
  }
}
