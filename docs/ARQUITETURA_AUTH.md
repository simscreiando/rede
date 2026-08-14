# Arquitetura de autenticação e sessão

## Por que cookies, não localStorage

A Fase 0 usava `localStorage` para guardar a sessão do Supabase no
navegador. Isso quebra exatamente o requisito P1 de "acesso direto por URL
deve ser bloqueado no servidor": `localStorage` só existe depois que o JS do
navegador rodou, então o **primeiro** carregamento de uma rota (SSR — o que
acontece quando alguém cola uma URL direto na barra de endereço, ou dá F5)
não tinha como o servidor saber se a pessoa estava logada. `beforeLoad`
rodando no servidor não tinha nenhuma sessão para ler.

A correção (auditoria, Fase 2) troca `localStorage` por cookies, usando o
pacote oficial `@supabase/ssr`:

- **Navegador** (`src/integrations/supabase/client.ts`): `createBrowserClient`,
  que já escreve/lê a sessão em cookies em vez de `localStorage`.
- **Servidor** (`src/integrations/supabase/ssr-client.ts`): `createServerClient`,
  lendo/escrevendo os mesmos cookies via `getCookies`/`setCookie` do
  TanStack Start (`@tanstack/react-start/server`).

Como os dois lados usam cookie, o servidor consegue ler a sessão **mesmo na
primeira requisição SSR** — é o que faz `src/routes/_protected.tsx` (o
`beforeLoad` real) funcionar de verdade contra acesso direto por URL.

## O que isso NÃO substitui

`beforeLoad` protege a experiência de navegação (evita que a pessoa veja uma
tela que não devia). Ele **não é** o limite de segurança dos dados — cada
server function que devolve dado sensível continua validando a própria
sessão via `requireSupabaseAuth` (agora também baseado no client de
cookies), e a garantia final continua sendo RLS no banco. Mesmo se um bug
algum dia deixasse `beforeLoad` passar batido, as policies de RLS das
migrations `0001`-`0009` continuam de pé.

## Três clients Supabase distintos — não confundir

| Arquivo | Usa | Onde pode ser importado | Ignora RLS? |
|---|---|---|---|
| `client.ts` | anon key, cookies (browser) | Componentes/rotas do navegador | Não |
| `ssr-client.ts` | anon key, cookies (servidor) | `beforeLoad`, server functions | Não |
| `client.server.ts` | **service-role key** | Só server functions que precisam de privilégio administrativo (ex.: gerar signed URL, exclusão de conta) | **Sim — usar com cautela** |

## Fluxo completo do Google OAuth (implementado na Fase 2)

```
Saudade Social (/auth, botão "Entrar com Google")
  → supabase.auth.signInWithOAuth({ provider: "google", redirectTo: AUTH_CALLBACK_URL })
  → Google
  → Supabase (troca o código do Google por um "code" de sessão do Supabase)
  → /auth/callback (client.ts: exchangeCodeForSession — troca o "code" da URL pela sessão real, grava nos cookies)
  → navigate("/perfil")
  → beforeLoad de /_protected roda no servidor, lê a sessão do cookie:
      - sem sessão → /auth
      - sessão mas beta não autorizado → /acesso-restrito
      - beta ok mas 18+ não confirmado → /confirmar-idade
      - tudo ok → renderiza /perfil
```

O bloqueio de CADASTRO (conta nova, e-mail não autorizado) acontece um passo
antes disso, dentro do próprio Supabase: o Auth Hook "Before User Created"
(migration `0007_security_audit_fixes.sql`) rejeita a criação da conta antes
mesmo do Google/GoTrue terminarem o fluxo — por isso é o mesmo mecanismo
para e-mail/senha e para Google (os dois criam uma linha em `auth.users`).
