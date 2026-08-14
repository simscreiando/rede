-- ============================================================================
-- 0001 — FUNDAÇÃO: papéis, schema privado e closed beta gate
-- ============================================================================
-- Este arquivo cria a camada de segurança que todo o resto do sistema usa:
--   1. app_private — schema não exposto pela API do PostgREST, onde vivem
--      funções SECURITY DEFINER e configurações internas.
--   2. user_roles — papéis (admin/moderator/user), nunca um campo em profiles.
--   3. app_settings — feature flags internas (ex.: beta_mode_enabled),
--      lidas pelas funções/triggers do banco. Não confundir com env vars do
--      Node: env vars controlam a UI; app_settings controla a aplicação
--      da regra dentro do próprio Postgres, que é a linha de defesa real.
--   4. beta_access — e-mails/códigos autorizados a entrar durante o closed
--      beta, com status active/revoked.
--   5. Triggers em auth.users e auth.sessions que bloqueiam, dentro do
--      próprio banco, qualquer criação de conta ou sessão não autorizada —
--      isso vale para cadastro por e-mail E para Google OAuth, porque os
--      dois caminhos passam pelo GoTrue e escrevem nessas mesmas tabelas.
--      É a garantia de que o gate não pode ser contornado batendo direto
--      na API do Supabase, e não apenas escondendo um botão no frontend.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;
-- app_private nunca recebe GRANT para anon/public — só é acessível via
-- funções SECURITY DEFINER específicas, nunca por SELECT direto do cliente.

-- ============ papéis ============
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION app_private.is_moderator(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('moderator', 'admin')
  )
$$;

CREATE OR REPLACE FUNCTION app_private.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  )
$$;

REVOKE ALL ON FUNCTION app_private.is_moderator(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.is_moderator(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.is_admin(uuid) TO authenticated, service_role;

CREATE POLICY "user_roles_select_own_or_moderator" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR app_private.is_moderator(auth.uid()));

-- gatilho genérico de updated_at, reaproveitado por várias tabelas
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============ audit_log (infraestrutura transversal) ============
-- Criada aqui na fundação porque várias funções de domínios diferentes
-- (depoimentos, moderação, exclusão de conta) precisam gravar nela.
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_moderator" ON public.audit_log
FOR SELECT TO authenticated USING (app_private.is_moderator(auth.uid()));

-- Inserção só acontece de dentro de funções SECURITY DEFINER (nunca INSERT
-- livre do cliente com actor_id arbitrário) — por isso a policy exige que
-- o ator seja o próprio usuário autenticado da sessão atual, que é sempre
-- o caso quando a inserção vem de uma função SECURITY DEFINER chamada por
-- esse mesmo usuário.
CREATE POLICY "audit_log_insert_self" ON public.audit_log
FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

CREATE INDEX idx_audit_log_target ON public.audit_log (target_type, target_id, created_at DESC);

-- ============ app_settings (feature flags internas) ============
CREATE TABLE app_private.app_settings (
  key text PRIMARY KEY,
  value boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Estado inicial: closed beta LIGADO por padrão (mais seguro para um projeto
-- ainda em planejamento). Alterar para false quando o produto abrir ao
-- público — não requer deploy novo, só um UPDATE nesta tabela.
INSERT INTO app_private.app_settings (key, value) VALUES ('beta_mode_enabled', true);

CREATE OR REPLACE FUNCTION app_private.is_beta_mode_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT value FROM app_private.app_settings WHERE key = 'beta_mode_enabled'), true)
$$;

-- Exposta via RPC só para leitura (a UI precisa saber se deve mostrar a
-- mensagem de "fase de testes"); alteração do valor é feita só por admin,
-- nunca pelo cliente comum.
CREATE OR REPLACE FUNCTION public.get_beta_mode_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_private.is_beta_mode_enabled()
$$;
REVOKE ALL ON FUNCTION public.get_beta_mode_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_beta_mode_enabled() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_beta_mode_enabled(_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT app_private.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar o modo de closed beta';
  END IF;
  UPDATE app_private.app_settings SET value = _enabled, updated_at = now()
  WHERE key = 'beta_mode_enabled';
END;
$$;
REVOKE ALL ON FUNCTION public.set_beta_mode_enabled(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_beta_mode_enabled(boolean) TO authenticated;

-- ============ beta_access ============
CREATE TABLE public.beta_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- MVP: autorização por e-mail. Colunas de invite_code já modeladas para
  -- não exigir reconstrução quando essa forma for adicionada (decisão 14.5
  -- do prompt de implementação): ficam NULL enquanto não usadas.
  email text,
  invite_code text,
  status text NOT NULL DEFAULT 'active',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  expires_at timestamptz,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT beta_access_status_check CHECK (status IN ('active', 'revoked')),
  CONSTRAINT beta_access_has_identifier CHECK (email IS NOT NULL OR invite_code IS NOT NULL)
);

CREATE UNIQUE INDEX beta_access_email_key ON public.beta_access (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX beta_access_invite_code_key ON public.beta_access (invite_code) WHERE invite_code IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.beta_access TO authenticated;
GRANT ALL ON public.beta_access TO service_role;
ALTER TABLE public.beta_access ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER beta_access_set_updated_at
BEFORE UPDATE ON public.beta_access
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Só administradores gerenciam a lista. Uma pessoa comum não pode nem ler a
-- lista inteira (evita enumeração de e-mails autorizados).
CREATE POLICY "beta_access_admin_all" ON public.beta_access
FOR ALL TO authenticated
USING (app_private.is_admin(auth.uid()))
WITH CHECK (app_private.is_admin(auth.uid()));

-- ============ função central de autorização do beta ============
-- Usada pelos triggers de auth.users/auth.sessions abaixo e por qualquer
-- rota que precise reconfirmar autorização (ex.: beforeLoad de rota privada).
CREATE OR REPLACE FUNCTION app_private.is_beta_authorized(_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT app_private.is_beta_mode_enabled()
     OR EXISTS (
       SELECT 1 FROM public.beta_access
       WHERE lower(email) = lower(_email)
         AND status = 'active'
         AND (expires_at IS NULL OR expires_at > now())
     )
$$;
REVOKE ALL ON FUNCTION app_private.is_beta_authorized(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.is_beta_authorized(text) TO authenticated, service_role;

-- Versão exposta via RPC para o frontend checar o próprio status (ex.: tela
-- de "acesso não autorizado" explicando o motivo), nunca o de terceiros.
CREATE OR REPLACE FUNCTION public.check_my_beta_access()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_private.is_beta_authorized(COALESCE(auth.jwt() ->> 'email', ''))
$$;
REVOKE ALL ON FUNCTION public.check_my_beta_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_my_beta_access() TO authenticated;

-- Checagem por e-mail explícito, usada pelo formulário de cadastro ANTES de
-- chamar auth.signUp — evita mandar a pessoa para o Supabase só para levar
-- um erro. É apenas uma otimização de UX: a garantia real é o trigger
-- abaixo, que roda dentro da própria criação da conta e não pode ser
-- contornado chamando a API do Supabase diretamente.
CREATE OR REPLACE FUNCTION public.check_email_beta_access(_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_private.is_beta_authorized(_email)
$$;
REVOKE ALL ON FUNCTION public.check_email_beta_access(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_email_beta_access(text) TO anon, authenticated;

-- ============ enforcement no nível do banco (auth.users / auth.sessions) ============
-- Bloqueia CRIAÇÃO DE CONTA (cadastro por e-mail e primeiro login Google,
-- que também insere em auth.users) quando o e-mail não está autorizado.
CREATE OR REPLACE FUNCTION app_private.enforce_beta_access_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT app_private.is_beta_authorized(NEW.email) THEN
    RAISE EXCEPTION 'Cadastro bloqueado: e-mail não autorizado para o closed beta da Saudade Social'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_beta_access_on_signup ON auth.users;
CREATE TRIGGER enforce_beta_access_on_signup
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION app_private.enforce_beta_access_on_signup();

-- Bloqueia LOGIN (nova sessão) de contas já existentes cuja autorização foi
-- revogada depois do cadastro. Cobre e-mail/senha e Google, porque ambos
-- criam uma linha em auth.sessions ao autenticar.
CREATE OR REPLACE FUNCTION app_private.enforce_beta_access_on_session()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _email text;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = NEW.user_id;
  IF _email IS NULL OR NOT app_private.is_beta_authorized(_email) THEN
    RAISE EXCEPTION 'Sessão bloqueada: acesso ao closed beta da Saudade Social não está autorizado'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_beta_access_on_session ON auth.sessions;
CREATE TRIGGER enforce_beta_access_on_session
BEFORE INSERT ON auth.sessions
FOR EACH ROW EXECUTE FUNCTION app_private.enforce_beta_access_on_session();

-- NOTA DE OPERAÇÃO (documentar também no README):
-- Estes dois triggers tocam tabelas do schema `auth`, que pertence ao
-- Supabase. Isso é um padrão suportado (é o mesmo mecanismo usado pelo
-- trigger clássico "on_auth_user_created" da documentação do Supabase),
-- mas precisa ser aplicado com um usuário com privilégio suficiente
-- (a role usada pelas migrations do Supabase CLI/dashboard já tem esse
-- privilégio). Validar isso de ponta a ponta é o primeiro item de teste
-- da Fase 2, antes de qualquer outra funcionalidade de auth.
