import { useEffect, useState } from "react";
import AuthScreen from "./components/AuthScreen.jsx";
import Dashboard from "./components/Dashboard.jsx";
import { initializeFinanceApp } from "./lib/seedFinance.js";
import { getLoggedUser, logoutUser, setLoggedUser } from "./lib/storage.js";

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    initializeFinanceApp();
    setUser(getLoggedUser());
  }, []);

  function handleLogin(loggedUser) {
    setLoggedUser(loggedUser);
    setUser(loggedUser);
  }

  function handleLogout() {
    logoutUser();
    setUser(null);
  }

  return user ? <Dashboard user={user} onUserUpdate={handleLogin} onLogout={handleLogout} /> : <AuthScreen onLogin={handleLogin} />;
}
