# Decisões provisórias do MVP

Estas decisões foram tomadas para não bloquear a implementação, conforme
autorizado explicitamente no prompt de implementação (seção 14). Todas podem
ser revistas — nenhuma é definitiva. Cada uma referencia onde está
implementada.

## 14.1 — Pedido de amizade cruzado
Se A→B está `pending` e B manda pedido para A, os dois viram `accepted`
automaticamente (sem criar uma segunda linha).
**Implementado em:** `supabase/migrations/0002_profiles_friendships_blocks_badges.sql`,
função/trigger `app_private.handle_friend_request`.

## 14.2 — Bloqueio
`blocked` não é um status de `friendships`. É uma tabela separada, `blocks`,
usada por outras políticas de RLS (perfis, pedidos de amizade, recados).
**Implementado em:** mesma migration acima, tabela `public.blocks` e função
`app_private.is_blocked`.

## 14.3 — Declined / cancelled
Estados válidos de `friendships.status`: `pending`, `accepted`, `declined`,
`cancelled`. Depois de `declined`/`cancelled`, um novo pedido pode ser
criado (o índice único só bloqueia par ativo em `pending`/`accepted`).
**Implementado em:** mesma migration, `CHECK` de status + índice único
parcial `friendships_unique_active_pair`.

## 14.4 — Retenção na exclusão de conta
**Ainda não implementado** (Fase 7, por definição de escopo). A arquitetura
já prevê que isso não será um `DELETE` ingênuo: a Fase 0 já modela
`removed_by_moderation` como campo de ocultação (em vez de apagar
conteúdo moderado) e `audit_log`/`moderation_actions` como tabelas que
plausivelmente precisam sobreviver à exclusão de conta do autor, ao menos
por um período. **Decisão jurídica pendente:** por quanto tempo reter
registros de moderação/auditoria depois de uma exclusão de conta. Isso
precisa ser respondido antes de escrever o texto final da política de
privacidade e a lógica definitiva de exclusão — ver `src/routes/privacidade.tsx`.

## 14.5 — Closed beta
MVP implementa **apenas** autorização por e-mail pré-cadastrado
(`beta_access.email`). A coluna `invite_code` já existe no schema, mas sem
nenhuma lógica de geração/uso ainda — pode ser ligada depois sem alterar a
estrutura da tabela nem os triggers de enforcement.
**Implementado em:** `supabase/migrations/0001_foundation_roles_and_beta.sql`.

## 14.6 — Comunidades fechadas
MVP implementa **apenas** entrada imediata em comunidade aberta
(`is_open = true`). Comunidade fechada existe no schema (`is_open = false`),
mas a RLS **bloqueia** entrada direta nela até o fluxo de convite/aprovação
ser implementado de fato — de propósito, para não fingir uma funcionalidade
inexistente.
**Implementado em:** `supabase/migrations/0004_communities.sql`, policy
`community_members_insert_own_open_only`.

## 14.7 — Administração de comunidade
O `creator_id` da comunidade é o administrador dela. Não existe (ainda) um
papel de "co-admin" ou múltiplos administradores por comunidade — isso é
conceitualmente separado do papel de moderador global (`user_roles`).
**Implementado em:** `supabase/migrations/0004_communities.sql`, função
`app_private.is_community_admin`.
