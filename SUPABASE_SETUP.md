# Configuração Supabase e Netlify

## 1. Criar o banco e as regras de segurança

1. No projeto Supabase, abra **SQL Editor**.
2. Clique em **New query**.
3. Copie todo o conteúdo de `supabase/schema.sql`.
4. Cole no editor e clique em **Run**.

O script cria `profiles` e `finance_months`, ativa RLS, restringe cada usuário aos próprios dados e concede leitura administrativa a `jhonatandasilva.dev@gmail.com`.

## 2. Configurar URLs de autenticação

No Supabase, abra **Authentication > URL Configuration**:

- **Site URL**: URL principal do site no Netlify.
- **Redirect URLs**: adicione a URL do Netlify e `http://127.0.0.1:5173` para testes locais.

## 3. Configurar o Netlify

Em **Site configuration > Environment variables**, crie:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_ADMIN_EMAIL`
- `VITE_ADMIN_USERNAME`
- `SUPABASE_SECRET_KEY` (somente escopo Functions; nunca use o prefixo `VITE_` nesta chave)

Use os mesmos valores do arquivo local `.env.local`. Depois faça um novo deploy.

## 4. Usar acesso somente com usuário e senha

Em **Authentication > Providers > Email**, desative **Confirm email**. O aplicativo cria internamente um identificador técnico para o Supabase, mas a interface solicita e exibe somente usuário e senha.

## 5. Criar a conta administrativa

Entre na conta local principal e conclua o aviso de atualização usando o usuário `john` e a senha atual. O app associa internamente essa conta ao e-mail administrativo configurado.

Depois, entre no app usando `john` e a mesma senha.

## 6. Migração de usuários antigos

Contas antigas continuam entrando com o usuário e a senha salvos no navegador. No aviso de atualização, o usuário informa novamente as mesmas credenciais e clica em **Salvar**.

Os dados locais não são apagados após a cópia e permanecem como backup naquele navegador.

As senhas das novas contas são processadas pelo Supabase Auth e nunca são exibidas pelo app. As credenciais antigas continuam apenas no armazenamento local já existente até a migração. A função administrativa de senha temporária exige uma **Secret key** do Supabase armazenada somente no Netlify como `SUPABASE_SECRET_KEY` com escopo de Functions.
