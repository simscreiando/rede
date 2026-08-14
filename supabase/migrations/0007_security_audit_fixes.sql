-- ============================================================================
-- 0007 — CORREÇÕES DA AUDITORIA DE SEGURANÇA DA FASE 0
-- ============================================================================
-- Este arquivo não edita as migrations 0001-0006 (que já foram entregues e
-- documentadas) — ele registra as correções como uma migration própria,
-- para manter o histórico de auditoria rastreável. Nada disso foi aplicado
-- a um projeto Supabase real ainda, então este é o schema definitivo a ser
-- aplicado, não um "hotfix sobre produção".

-- ============================================================================
-- 1. AUDIT_LOG — remover a capacidade do cliente de inserir diretamente
-- ============================================================================
-- Achado: GRANT INSERT para authenticated + policy "actor_id = auth.uid()"
-- permitia que qualquer usuário autenticado criasse uma linha em audit_log
-- com action/target/metadata arbitrários (só o actor_id era garantido).
-- Correção: remove completamente a capacidade de INSERT do cliente. As
-- funções SECURITY DEFINER que gravam auditoria (set_testimonial_status,
-- apply_moderation_action, e as futuras de exclusão de conta) são donas
-- do schema (role com privilégio de owner/BYPASSRLS no Supabase, o mesmo
-- papel que roda as migrations), então continuam gravando normalmente —
-- RLS não bloqueia SECURITY DEFINER executado por um role com BYPASSRLS.
REVOKE INSERT ON public.audit_log FROM authenticated;
DROP POLICY IF EXISTS "audit_log_insert_self" ON public.audit_log;

-- Trilha imutável: ninguém (nem moderador) pode alterar ou apagar uma linha
-- já gravada via client role; só service_role (operação administrativa
-- excepcional, ex.: pedido de exclusão de dados amparado por lei) mantém
-- esse privilégio, concedido em 0001.
REVOKE UPDATE, DELETE ON public.audit_log FROM authenticated;

-- ============================================================================
-- 2. BOOTSTRAP DE ADMINISTRADOR — RPC de gestão de papéis (sem auto-promoção)
-- ============================================================================
-- A migration 0001 já concede apenas SELECT em user_roles para authenticated
-- (nunca INSERT/UPDATE/DELETE) — ou seja, promoção/auto-promoção via client
-- já era impossível mesmo antes desta correção. O que faltava era um
-- caminho oficial para um admin já existente gerenciar papéis pela
-- aplicação. Esta função cobre isso; o PRIMEIRO admin continua exigindo
-- bootstrap manual fora da RLS — ver docs/BOOTSTRAP_ADMIN.md.
CREATE OR REPLACE FUNCTION public.set_user_role(_target_user_id uuid, _role public.app_role, _grant boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT app_private.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem gerenciar papéis';
  END IF;

  IF _role = 'admin' AND _target_user_id = auth.uid() AND NOT _grant THEN
    RAISE EXCEPTION 'Um administrador não pode remover o próprio papel de admin (evita ficar sem nenhum admin por engano)';
  END IF;

  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_target_user_id, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _target_user_id AND role = _role;
  END IF;

  INSERT INTO public.audit_log (actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'user_role_changed', 'user', _target_user_id,
          jsonb_build_object('role', _role, 'grant', _grant));
END;
$$;
REVOKE ALL ON FUNCTION public.set_user_role(uuid, public.app_role, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role, boolean) TO authenticated;

-- ============================================================================
-- 3. CLOSED BETA — remover a API de enumeração de e-mails
-- ============================================================================
-- Achado: check_email_beta_access(email) era GRANT EXECUTE para anon e
-- authenticated e devolvia true/false diretamente — um script simples
-- testando uma lista de e-mails descobriria quais estão autorizados
-- (enumeração), mesmo sem nenhuma mensagem de erro reveladora.
-- Correção: a função deixa de ser chamável por anon/authenticated. A UX
-- (Fase 2) não faz mais uma pré-checagem por e-mail; ela tenta o cadastro
-- de verdade e, se for rejeitado pelo Auth Hook (ver item 5), mostra uma
-- mensagem genérica de "acesso restrito", sem confirmar nem negar
-- especificamente aquele e-mail.
REVOKE EXECUTE ON FUNCTION public.check_email_beta_access(text) FROM anon, authenticated;
-- Mantida apenas para uso administrativo futuro (ex.: painel de admin via
-- service-role), por isso o REVOKE acima em vez de DROP.

-- get_beta_mode_enabled() continua público — expõe só um booleano global
-- (o modo beta está ligado ou não), nunca informação por e-mail, então não
-- é um vetor de enumeração.

-- ============================================================================
-- 4. FUNDAÇÃO DE COMUNIDADE — criador vira membro automaticamente
-- ============================================================================
-- Achado: criar uma comunidade não inseria o criador em community_members,
-- então o próprio criador não conseguiria postar tópicos nela (a policy de
-- INSERT em community_topics exige is_community_member).
CREATE OR REPLACE FUNCTION app_private.add_creator_as_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.community_members (community_id, user_id)
  VALUES (NEW.id, NEW.creator_id)
  ON CONFLICT (community_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS communities_after_insert_add_creator ON public.communities;
CREATE TRIGGER communities_after_insert_add_creator
AFTER INSERT ON public.communities
FOR EACH ROW EXECUTE FUNCTION app_private.add_creator_as_member();

-- ============================================================================
-- 5. TRIGGERS DE AUTH — substituir por Auth Hooks oficiais do Supabase
-- ============================================================================
-- Achado (autocrítica): a Fase 0 usou triggers BEFORE INSERT diretamente em
-- auth.users e auth.sessions. Isso tecnicamente funciona no Postgres, mas
-- são tabelas internas do GoTrue, não uma interface pública e estável do
-- Supabase — modificá-las por fora carrega risco real de:
--   a) o trigger em auth.sessions interferir em fluxos internos do GoTrue
--      (refresh de token, múltiplos dispositivos, fluxos de recovery) que
--      não têm documentação pública detalhada sobre como/quando inserem
--      linhas em auth.sessions — eu não tinha (e ainda não tenho) como
--      confirmar isso sem testar contra um projeto Supabase real;
--   b) qualquer mudança futura no schema interno do Supabase quebrar os
--      triggers silenciosamente.
-- Pesquisei a documentação oficial do Supabase (Auth Hooks) e confirmei que
-- existe uma extensão point OFICIAL e documentada exatamente para o nosso
-- caso: o "Before User Created Hook", que a própria documentação do
-- Supabase descreve como recomendado para "invite-only beta access". Ele
-- roda ANTES da criação do usuário (cobre e-mail/senha E Google, porque os
-- dois criam uma linha em auth.users), tem um contrato de entrada/saída
-- estável (jsonb com "event"/"error"), e é registrado via configuração do
-- projeto (config.toml ou Dashboard → Authentication → Hooks), não por um
-- trigger que nós mesmos penduramos no schema interno.
--
-- Não existe (na documentação que consultei) um hook oficial equivalente
-- para "bloquear emissão de token em um login de conta já revogada" — o
-- "Custom Access Token Hook" documentado só permite CUSTOMIZAR claims, sem
-- um campo de erro documentado para REJEITAR a emissão. Por isso, para
-- revogação de acesso já concedido, a estratégia muda (ver nota abaixo):
-- em vez de tentar bloquear a emissão do token, o app reconfirma a
-- autorização a cada navegação/carregamento de rota privada, no servidor
-- (checkMyBetaAccess, já implementada na Fase 0) — isso é o suficiente
-- para cumprir o requisito ("próxima navegação/checagem bloqueia"), sem
-- depender de um mecanismo não documentado/não verificado.

DROP TRIGGER IF EXISTS enforce_beta_access_on_signup ON auth.users;
DROP FUNCTION IF EXISTS app_private.enforce_beta_access_on_signup();

DROP TRIGGER IF EXISTS enforce_beta_access_on_session ON auth.sessions;
DROP FUNCTION IF EXISTS app_private.enforce_beta_access_on_session();

-- Auth Hook oficial: "Before User Created". Payload de entrada:
-- { "metadata": {...}, "user": { "email": "...", ... } }. Retornar '{}'::jsonb
-- permite o cadastro; retornar {"error": {"http_code":..., "message":...}}
-- bloqueia e propaga a mensagem ao cliente.
CREATE OR REPLACE FUNCTION public.hook_restrict_signup_by_beta_access(event jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  _email text;
BEGIN
  _email := event -> 'user' ->> 'email';

  IF _email IS NULL OR NOT app_private.is_beta_authorized(_email) THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Este acesso está restrito durante a fase de testes da Saudade Social.'
      )
    );
  END IF;

  RETURN '{}'::jsonb;
END;
$$;

-- Conforme o padrão documentado pelo Supabase para Auth Hooks em Postgres:
-- só o role interno supabase_auth_admin pode executar; ninguém mais.
REVOKE ALL ON FUNCTION public.hook_restrict_signup_by_beta_access(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hook_restrict_signup_by_beta_access(jsonb) TO supabase_auth_admin;

-- NOTA DE OPERAÇÃO — ativação manual obrigatória (não acontece só com esta
-- migration): depois de aplicar este SQL, é preciso registrar o hook no
-- projeto, em Authentication → Hooks → "Before user created" (Dashboard),
-- apontando para a função public.hook_restrict_signup_by_beta_access — ou
-- equivalente em supabase/config.toml:
--
--   [auth.hook.before_user_created]
--   enabled = true
--   uri = "pg-functions://postgres/public/hook_restrict_signup_by_beta_access"
--
-- Sem esse passo de configuração, a função existe no banco mas NÃO é
-- chamada pelo GoTrue — o gate não funciona só por a função existir.
-- Este é literalmente o primeiro item a validar contra o Supabase real
-- (ver seção de testes não executados).
