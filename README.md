# White Cat Finance App

Aplicativo financeiro React/Vite com autenticação, sincronização em nuvem e isolamento de dados por usuário usando Supabase.

## Configuração

1. Copie `.env.example` para `.env.local` e preencha as variáveis públicas do Supabase.
2. Execute `supabase/schema.sql` no SQL Editor do projeto Supabase.
3. Consulte `SUPABASE_SETUP.md` para configurar autenticação e Netlify.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://127.0.0.1:5173/`.

## Build

```bash
npm run build
```

O cadastro e o acesso usam somente usuário e senha. Contas antigas continuam entrando normalmente e confirmam as mesmas credenciais uma única vez para sincronizar os dados. As senhas são administradas pelo Supabase Auth e nunca são exibidas pelo aplicativo.
