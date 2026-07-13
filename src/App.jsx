import { Center, Spinner } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import AuthScreen from "./components/AuthScreen.jsx";
import Dashboard from "./components/Dashboard.jsx";
import { getProfile } from "./lib/cloudFinance.js";
import { clearLegacySession, ensureLocalTestUser, restoreLegacyUser } from "./lib/legacyAuth.js";
import { supabase } from "./lib/supabase.js";
import { notify } from "./toast.js";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const activeSessionKey = useRef("");

  useEffect(() => {
    let active = true;
    ensureLocalTestUser();

    async function applySession(session) {
      if (!active) return;
      if (!session?.user) {
        activeSessionKey.current = "";
        setUser(restoreLegacyUser());
        setLoading(false);
        return;
      }

      const sessionKey = `${session.user.id}:${session.user.email}`;
      if (activeSessionKey.current === sessionKey) return;
      activeSessionKey.current = sessionKey;

      try {
        const profile = await getProfile(session.user.id);
        const nextUser = { ...session.user, username: profile.username, role: profile.role };
        setUser(nextUser);
      } catch (error) {
        activeSessionKey.current = "";
        notify({ status: "error", title: "Não foi possível carregar o perfil", description: error.message });
        setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => applySession(session), 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    clearLegacySession();
    if (user?.legacy) {
      setUser(null);
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) notify({ status: "error", title: "Não foi possível sair", description: error.message });
  }

  if (loading) {
    return (
      <Center minH="100vh">
        <Spinner size="xl" color="brand.500" thickness="4px" />
      </Center>
    );
  }

  return user
    ? <Dashboard user={user} onUserUpdate={setUser} onLogout={handleLogout} />
    : <AuthScreen onLegacyLogin={setUser} />;
}
