const USERS_KEY = "users";
const LOGGED_USER_KEY = "loggedUser";

export function ensureLocalTestUser() {
  if (!import.meta.env.DEV || import.meta.env.VITE_ENABLE_LOCAL_TEST_USER !== "true") return;
  const username = String(import.meta.env.VITE_TEST_USERNAME || "admin");
  const password = String(import.meta.env.VITE_TEST_PASSWORD || "admin");
  const users = readJson(USERS_KEY, []);
  if (!users.some((user) => user?.email === username)) {
    localStorage.setItem(USERS_KEY, JSON.stringify([...users, { email: username, password }]));
  }
}

export function authenticateLegacyUser(username, password) {
  const normalizedUsername = String(username || "").trim();
  const saved = readJson(USERS_KEY, []).find((user) => user?.email === normalizedUsername && user?.password === password);
  if (!saved) return null;
  localStorage.setItem(LOGGED_USER_KEY, JSON.stringify(saved));
  return toLegacySession(saved);
}

export function restoreLegacyUser() {
  const logged = readJson(LOGGED_USER_KEY, null);
  if (!logged?.email || !logged?.password) return null;
  const valid = readJson(USERS_KEY, []).some((user) => user?.email === logged.email && user?.password === logged.password);
  return valid ? toLegacySession(logged) : null;
}

export function clearLegacySession() {
  localStorage.removeItem(LOGGED_USER_KEY);
}

function toLegacySession(user) {
  return {
    id: `legacy:${user.email}`,
    email: user.email,
    username: user.email,
    legacyPassword: user.password,
    legacy: true,
    role: "user",
  };
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
