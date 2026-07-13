import { createClient } from "@supabase/supabase-js";

export default async (request) => {
  try {
    return await handleRequest(request);
  } catch (error) {
    console.error("admin-reset-password failed", error);
    return json({ error: "Erro interno ao definir a senha temporária." }, 500);
  }
};

async function handleRequest(request) {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !publishableKey || !secretKey) return json({ error: "Função administrativa ainda não configurada." }, 500);

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Sessão administrativa ausente." }, 401);

  const userClient = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const adminClient = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Sessão administrativa inválida." }, 401);

  const { data: profile } = await adminClient.from("profiles").select("role").eq("id", authData.user.id).single();
  if (profile?.role !== "admin") return json({ error: "Acesso permitido somente ao administrador." }, 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Dados inválidos." }, 400);
  }
  if (!body.userId || typeof body.password !== "string" || body.password.length < 8) {
    return json({ error: "Informe uma senha temporária com pelo menos 8 caracteres." }, 400);
  }

  const { error } = await adminClient.auth.admin.updateUserById(body.userId, { password: body.password });
  if (error) return json({ error: error.message }, 400);
  return json({ success: true });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}
