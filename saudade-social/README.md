# Saudade Social

> A saudade daquela internet, com as regras de hoje.

Rede social própria inspirada na cultura da Web 2.0 — comunidades, amizades,
depoimentos, memória digital — com autonomia e privacidade incorporadas ao
produto. **Não é um clone** de Orkut, Facebook ou qualquer outra rede.

Este repositório é a reconstrução da base técnica anterior, com identidade e
segurança próprias. Ver `docs/DECISOES_PROVISORIAS.md` para as decisões de
produto assumidas para não bloquear o MVP, e o histórico da conversa de
engenharia para o diagnóstico completo da implementação anterior.

## Stack

- React 19 + TypeScript
- TanStack Start + TanStack Router
- Tailwind CSS 4
- Supabase (Auth + Postgres + RLS + Storage)
- Vercel (deploy, via integração nativa GitHub↔Vercel)
- Bun (gerenciador de pacotes)

Nenhuma dependência estrutural do Lovable. Nenhum uso de GitHub Pages.

## Setup local

```bash
bun install
cp .env.example .env
# preencha .env com os valores do seu projeto Supabase (ver comentários no arquivo)
bun run dev
```

## Banco de dados

As migrations em `supabase/migrations/` são a fonte da verdade do schema.
Aplique-as com a Supabase CLI:

```bash
supabase link --project-ref <seu-project-ref>
supabase db push
```

Depois de aplicar, gere os tipos TypeScript definitivos (o arquivo atual em
`src/integrations/supabase/types.ts` é um placeholder deliberado):

```bash
supabase gen types typescript --project-id <seu-project-ref> > src/integrations/supabase/types.ts
```

### Ordem e conteúdo das migrations

| Arquivo | Conteúdo |
|---|---|
| `0001_foundation_roles_and_beta.sql` | papéis, `app_private`, `audit_log`, `beta_access` |
| `0002_profiles_friendships_blocks_badges.sql` | perfis, amizades, bloqueios, selos |
| `0003_testimonials_scraps.sql` | depoimentos (update controlado via RPC), recados |
| `0004_communities.sql` | comunidades, tópicos, respostas |
| `0005_trust_safety.sql` | denúncias, moderação (com execução real da medida) |
| `0006_storage.sql` | bucket de avatares (criado público — **corrigido em 0008**) |
| `0007_security_audit_fixes.sql` | auditoria: audit_log travado, bootstrap de admin, closed beta sem enumeração, criador de comunidade vira membro, triggers de auth substituídos pelo Auth Hook oficial |
| `0008_storage_privacy.sql` | bucket de avatares passa a privado; entrega via signed URL |
| `0009_require_adult_confirmation.sql` | regra 18+ única, aplicada no banco (não contornável por nenhum provedor) |
| `0010_auto_create_profile.sql` | criação automática de `profiles` após `auth.users` |

### ⚠️ Passo manual obrigatório: registrar o Auth Hook

A migration `0007` cria a função `public.hook_restrict_signup_by_beta_access`,
mas **só criar a função não ativa nada** — é preciso registrar o hook no
projeto (Dashboard → Authentication → Hooks → "Before user created", ou via
`supabase/config.toml`):

```toml
[auth.hook.before_user_created]
enabled = true
uri = "pg-functions://postgres/public/hook_restrict_signup_by_beta_access"
```

Sem este passo, o closed beta **não bloqueia cadastro nenhum** — é o
primeiro item a validar contra o Supabase real, antes de qualquer outro
teste. Ver `docs/ARQUITETURA_AUTH.md` para o fluxo completo de auth/sessão.

## Closed beta

Enquanto `app_private.app_settings.beta_mode_enabled = true` (valor inicial),
cadastro só é permitido para e-mails presentes em `beta_access` com
`status = 'active'` — bloqueado no próprio Postgres pelo Auth Hook oficial
"Before User Created" (ver seção acima). A revogação de acesso de uma conta
já existente é reconfirmada a cada navegação em rota protegida, no servidor
(`beforeLoad` de `_protected.tsx` → `fetchAuthContext`), não depende de um
cookie de longa duração.

Para autorizar alguém durante o beta (via SQL editor do Supabase, como
admin):

```sql
insert into public.beta_access (email, invited_by, note)
values ('pessoa@exemplo.com', '<seu-user-id>', 'convite manual');
```

Para revogar:

```sql
update public.beta_access set status = 'revoked' where lower(email) = 'pessoa@exemplo.com';
```

Para desligar o modo beta (abrir ao público) sem precisar de novo deploy:

```sql
select public.set_beta_mode_enabled(false); -- precisa ser chamado por um admin autenticado
```

## Administração

Não existe autopromoção a admin — ver `docs/BOOTSTRAP_ADMIN.md` para o
procedimento (manual, único, feito no SQL Editor do Dashboard) de criar o
primeiro administrador do projeto.

## Variáveis de ambiente

Ver `.env.example` para a lista completa e comentada. Resumo:

- `VITE_PUBLIC_APP_URL` — nunca hardcode um domínio em código; tudo referencia esta variável.
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` — públicas, expostas ao navegador (esperado).
- `SUPABASE_SERVICE_ROLE_KEY` — **apenas** no ambiente de servidor da Vercel, nunca com prefixo `VITE_`.

## Deploy

GitHub é o repositório oficial. O deploy de produção e os previews de PR são
feitos pela integração nativa GitHub↔Vercel — o workflow em
`.github/workflows/ci.yml` só valida (lint/typecheck/test/build), não faz
deploy.

## Estado atual — Fase 0 (fundação)

Ver o relatório de fase na conversa de engenharia para o detalhe completo do
que foi entregue, o que ficou pendente e os próximos passos (Fase 1: shell +
identidade visual definitiva).
