import { applyJohnJuneSeed, initializeUsers } from "./storage.js";
import { migrateLegacyApril } from "./migrateLegacy.js";

export function initializeFinanceApp() {
  initializeUsers();
  applyJohnJuneSeed();
  migrateLegacyApril("john");
}
