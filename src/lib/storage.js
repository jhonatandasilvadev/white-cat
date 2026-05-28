import { junho2026Expenses, junho2026Salary } from "../data/seedJunho2026.js";
import { getMonthKey } from "./finance.js";

export const JOHN_USER = { email: "john", password: "Casinha123!" };
export const USERS_KEY = "users";
export const LOGGED_USER_KEY = "loggedUser";
export const JUNE_SEED_FLAG = "finance_seed_junho_2026_john_v2_applied";

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

export function getUsers() {
  return readJson(USERS_KEY, []);
}

export function saveUsers(users) {
  writeJson(USERS_KEY, users);
}

export function getLoggedUser() {
  return readJson(LOGGED_USER_KEY, null);
}

export function setLoggedUser(user) {
  writeJson(LOGGED_USER_KEY, user);
}

export function logoutUser() {
  localStorage.removeItem(LOGGED_USER_KEY);
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

export function initializeUsers() {
  const users = getUsers();
  const normalizedUsers = users.filter((user) => user?.email && user?.password);
  const johnIndex = normalizedUsers.findIndex((user) => user.email === JOHN_USER.email);

  if (johnIndex >= 0) {
    normalizedUsers[johnIndex] = JOHN_USER;
  } else {
    normalizedUsers.unshift(JOHN_USER);
  }

  saveUsers(normalizedUsers);

  const loggedUser = getLoggedUser();
  if (!loggedUser) {
    return;
  }

  const savedUser = normalizedUsers.find((user) => user.email === loggedUser.email);
  if (savedUser) {
    setLoggedUser(savedUser);
  } else {
    logoutUser();
  }
}

export function applyJohnJuneSeed() {
  if (!localStorage.getItem(JUNE_SEED_FLAG)) {
    saveSalary(JOHN_USER.email, 2026, 6, junho2026Salary);
    saveExpenses(JOHN_USER.email, 2026, 6, junho2026Expenses);
    localStorage.setItem(JUNE_SEED_FLAG, "true");
  }
}
