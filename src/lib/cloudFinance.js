import { getExpenses, getSalary, saveExpenses, saveSalary } from "./storage.js";
import { ADMIN_EMAIL, ADMIN_USERNAME, supabase } from "./supabase.js";

const saveQueues = new Map();

export async function getProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("id, email, username, role, created_at").eq("id", userId).single();
  if (error) throw error;
  return data;
}

export async function loadFinanceMonth(user, year, month) {
  const { data, error } = await supabase
    .from("finance_months")
    .select("salary, expenses")
    .eq("user_id", user.id)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (error) throw error;
  if (data) {
    const salary = Number(data.salary || 0);
    const expenses = Array.isArray(data.expenses) ? data.expenses : [];
    saveSalary(user.email, year, month, salary);
    saveExpenses(user.email, year, month, expenses);
    return { salary, expenses };
  }

  const salary = getSalary(user.email, year, month);
  const expenses = getExpenses(user.email, year, month);
  if (salary || expenses.length) {
    await saveFinanceMonth(user.id, year, month, salary, expenses);
  }
  return { salary, expenses };
}

export async function loadAllFinanceMonths(user) {
  const { data, error } = await supabase
    .from("finance_months")
    .select("year, month, salary, expenses")
    .eq("user_id", user.id);
  if (error) throw error;
  return (data || []).map((entry) => ({
    year: Number(entry.year),
    month: Number(entry.month),
    salary: Number(entry.salary || 0),
    expenses: Array.isArray(entry.expenses) ? entry.expenses : [],
  }));
}

export function saveFinanceMonth(userId, year, month, salary, expenses) {
  const queueKey = `${userId}-${year}-${month}`;
  const previous = saveQueues.get(queueKey) || Promise.resolve();
  const operation = previous.catch(() => {}).then(async () => {
    const { error } = await supabase.from("finance_months").upsert(
      {
        user_id: userId,
        year,
        month,
        salary: Number(salary || 0),
        expenses: Array.isArray(expenses) ? expenses : [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,year,month" },
    );
    if (error) throw error;
  });
  saveQueues.set(queueKey, operation);
  return operation.finally(() => {
    if (saveQueues.get(queueKey) === operation) saveQueues.delete(queueKey);
  });
}

export async function migrateLegacyFinance(user, role) {
  const migrationKey = `supabase_finance_migrated_${user.id}`;
  if (localStorage.getItem(migrationKey)) return 0;

  const allowedOwners = new Set([user.email.toLowerCase()]);
  if (role === "admin" && (user.email.toLowerCase() === ADMIN_EMAIL || user.username?.toLowerCase() === ADMIN_USERNAME)) {
    allowedOwners.add("john");
  }

  const months = new Map();
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    const match = key?.match(/^(salary|expenses)_(.+)_(\d{4})_(\d{2})$/);
    if (!match || !allowedOwners.has(match[2].toLowerCase())) continue;

    const [, type, owner, yearText, monthText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const id = `${year}-${month}`;
    const entry = months.get(id) || { year, month, salary: 0, expenses: [], owners: [] };
    entry.owners.push(owner);
    if (type === "salary") entry.salary = Number(localStorage.getItem(key) || 0);
    if (type === "expenses") {
      try {
        entry.expenses = JSON.parse(localStorage.getItem(key) || "[]");
      } catch {
        entry.expenses = [];
      }
    }
    months.set(id, entry);
  }

  const { data: existingMonths, error } = await supabase
    .from("finance_months")
    .select("year, month")
    .eq("user_id", user.id);
  if (error) throw error;
  const existingPeriods = new Set((existingMonths || []).map((entry) => `${entry.year}-${entry.month}`));

  let migratedCount = 0;
  for (const entry of months.values()) {
    if (existingPeriods.has(`${entry.year}-${entry.month}`)) continue;
    await saveFinanceMonth(user.id, entry.year, entry.month, entry.salary, entry.expenses);
    saveSalary(user.email, entry.year, entry.month, entry.salary);
    saveExpenses(user.email, entry.year, entry.month, entry.expenses);
    migratedCount += 1;
  }

  localStorage.setItem(migrationKey, new Date().toISOString());
  allowedOwners.forEach((owner) => localStorage.setItem(`legacy_finance_migrated_${user.id}_${owner}`, new Date().toISOString()));
  return migratedCount;
}

export function getLegacyMigrationSummary(userId, currentUsername) {
  const owners = getLegacyOwners();
  const normalizedCurrentUsername = String(currentUsername || "").trim().toLowerCase();
  if (!normalizedCurrentUsername) return null;

  const matchingOwner = [...owners.entries()].find(([owner]) => owner.trim().toLowerCase() === normalizedCurrentUsername);
  if (!matchingOwner) return null;

  const [username, months] = matchingOwner;
  if (localStorage.getItem(`legacy_finance_migrated_${userId}_${username.toLowerCase()}`)) return null;
  return { username, months: months.size };
}

export async function migrateLegacyAccount(user, username, password) {
  const normalizedUsername = String(username || "").trim();
  const legacyUsers = readLocalJson("users", []);
  const legacyUser = legacyUsers.find((item) => item?.email === normalizedUsername && item?.password === password);
  if (!legacyUser) {
    throw new Error("Usuário ou senha antiga não conferem neste navegador.");
  }

  const ownerMonths = getLegacyOwners().get(normalizedUsername);
  if (!ownerMonths?.size) {
    localStorage.setItem(`legacy_finance_migrated_${user.id}_${normalizedUsername.toLowerCase()}`, new Date().toISOString());
    return { months: 0, expenses: 0 };
  }

  const { data: remoteMonths, error } = await supabase
    .from("finance_months")
    .select("year, month, salary, expenses")
    .eq("user_id", user.id);
  if (error) throw error;
  const remoteByPeriod = new Map((remoteMonths || []).map((entry) => [`${entry.year}-${entry.month}`, entry]));
  let expenseCount = 0;

  for (const entry of ownerMonths.values()) {
    const period = `${entry.year}-${entry.month}`;
    const remote = remoteByPeriod.get(period);
    const mergedExpenses = mergeExpenses(entry.expenses, remote?.expenses);
    const mergedSalary = Number(remote?.salary || 0) || entry.salary;
    await saveFinanceMonth(user.id, entry.year, entry.month, mergedSalary, mergedExpenses);
    saveSalary(user.email, entry.year, entry.month, mergedSalary);
    saveExpenses(user.email, entry.year, entry.month, mergedExpenses);
    expenseCount += entry.expenses.length;
  }

  localStorage.setItem(`legacy_finance_migrated_${user.id}_${normalizedUsername.toLowerCase()}`, new Date().toISOString());
  return { months: ownerMonths.size, expenses: expenseCount };
}

export async function loadAdminData() {
  const [{ data: profiles, error: profilesError }, { data: months, error: monthsError }] = await Promise.all([
    supabase.from("profiles").select("id, email, username, role, created_at").order("created_at", { ascending: false }),
    supabase.from("finance_months").select("user_id, year, month, salary, expenses, updated_at").order("year", { ascending: false }),
  ]);

  if (profilesError) throw profilesError;
  if (monthsError) throw monthsError;
  return { profiles: profiles || [], months: months || [] };
}

function getLegacyOwners() {
  const owners = new Map();
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    const match = key?.match(/^(salary|expenses)_(.+)_(\d{4})_(\d{2})$/);
    if (!match) continue;
    const [, type, owner, yearText, monthText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const months = owners.get(owner) || new Map();
    const period = `${year}-${month}`;
    const entry = months.get(period) || { year, month, salary: 0, expenses: [] };
    if (type === "salary") entry.salary = Number(localStorage.getItem(key) || 0);
    if (type === "expenses") entry.expenses = readLocalJson(key, []);
    months.set(period, entry);
    owners.set(owner, months);
  }
  return owners;
}

function readLocalJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function mergeExpenses(legacyExpenses = [], remoteExpenses = []) {
  const merged = new Map();
  [...legacyExpenses, ...(Array.isArray(remoteExpenses) ? remoteExpenses : [])].forEach((expense, index) => {
    const key = expense?.id ?? [expense?.name, expense?.dueDate, expense?.value, expense?.installment, index].join("|");
    merged.set(String(key), expense);
  });
  return [...merged.values()];
}
