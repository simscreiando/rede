-- ============================================================================
-- 0002 — Perfis, amizades, bloqueios e selos de afinidade
-- ============================================================================

-- ============ perfis ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Pessoa da Saudade Social',
  username text UNIQUE,
  city text,
  bio text,
  avatar_url text,
  visibility text NOT NULL DEFAULT 'friends',
  is_adult_confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_visibility_check CHECK (visibility IN ('public', 'friends')),
  CONSTRAINT profiles_username_format CHECK (username IS NULL OR username ~ '^[a-z0-9_.]{3,24}$')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ bloqueios ============
-- Tabela separada de friendships (decisão provisória 14.2): mais simples de
-- referenciar nas políticas de outras tabelas do que mais um status dentro
-- de friendships.
CREATE TABLE public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocks_not_self CHECK (blocker_id <> blocked_id),
  UNIQUE (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION app_private.is_blocked(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a)
  )
$$;
REVOKE ALL ON FUNCTION app_private.is_blocked(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.is_blocked(uuid, uuid) TO authenticated, service_role;

CREATE POLICY "blocks_select_own" ON public.blocks
FOR SELECT TO authenticated
USING (blocker_id = auth.uid() OR app_private.is_moderator(auth.uid()));

CREATE POLICY "blocks_insert_own" ON public.blocks
FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "blocks_delete_own" ON public.blocks
FOR DELETE TO authenticated USING (blocker_id = auth.uid());

-- ============ amizades ============
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT friendships_status_check CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  CONSTRAINT friendships_not_self CHECK (requester_id <> addressee_id)
);
GRANT SELECT, INSERT, UPDATE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Só pode existir UM relacionamento ativo (pending OU accepted) por par de
-- usuários, em qualquer direção. Depois de declined/cancelled, um novo
-- pedido pode ser criado (decisão provisória 14.3).
CREATE UNIQUE INDEX friendships_unique_active_pair
ON public.friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id))
WHERE status IN ('pending', 'accepted');

-- Decisão provisória 14.1: se B já tinha mandado pedido pendente para A e A
-- manda um pedido para B, isso vira aceite mútuo automático em vez de duas
-- linhas conflitantes.
CREATE OR REPLACE FUNCTION app_private.handle_friend_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _reverse_id uuid;
BEGIN
  IF app_private.is_blocked(NEW.requester_id, NEW.addressee_id) THEN
    RAISE EXCEPTION 'Não é possível enviar pedido de amizade: relação bloqueada';
  END IF;

  SELECT id INTO _reverse_id
  FROM public.friendships
  WHERE requester_id = NEW.addressee_id
    AND addressee_id = NEW.requester_id
    AND status = 'pending';

  IF _reverse_id IS NOT NULL THEN
    UPDATE public.friendships
    SET status = 'accepted', responded_at = now()
    WHERE id = _reverse_id;
    RETURN NULL; -- cancela este INSERT; o pedido reverso virou aceite.
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS friendships_before_insert_merge ON public.friendships;
CREATE TRIGGER friendships_before_insert_merge
BEFORE INSERT ON public.friendships
FOR EACH ROW EXECUTE FUNCTION app_private.handle_friend_request();

CREATE OR REPLACE FUNCTION app_private.are_friends(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester_id = _a AND addressee_id = _b) OR (requester_id = _b AND addressee_id = _a))
  )
$$;
REVOKE ALL ON FUNCTION app_private.are_friends(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.are_friends(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.can_view_profile(_viewer uuid, _profile uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT app_private.is_blocked(_viewer, _profile)
     AND (
       _viewer = _profile
       OR app_private.are_friends(_viewer, _profile)
       OR EXISTS (SELECT 1 FROM public.profiles WHERE id = _profile AND visibility = 'public')
       OR app_private.is_moderator(_viewer)
     )
$$;
REVOKE ALL ON FUNCTION app_private.can_view_profile(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.can_view_profile(uuid, uuid) TO authenticated, service_role;

CREATE POLICY "profiles_select_visible" ON public.profiles
FOR SELECT TO authenticated
USING (app_private.can_view_profile(auth.uid(), id));

CREATE POLICY "profiles_insert_own" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own" ON public.profiles
FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_delete_own" ON public.profiles
FOR DELETE TO authenticated USING (id = auth.uid());

CREATE POLICY "friendships_select_involved" ON public.friendships
FOR SELECT TO authenticated
USING (requester_id = auth.uid() OR addressee_id = auth.uid() OR app_private.is_moderator(auth.uid()));

CREATE POLICY "friendships_insert_own_request" ON public.friendships
FOR INSERT TO authenticated
WITH CHECK (requester_id = auth.uid() AND status = 'pending' AND NOT app_private.is_blocked(auth.uid(), addressee_id));

-- addressee só pode responder (aceitar/recusar) um pedido pendente.
CREATE POLICY "friendships_update_addressee_respond" ON public.friendships
FOR UPDATE TO authenticated
USING (addressee_id = auth.uid() AND status = 'pending')
WITH CHECK (addressee_id = auth.uid() AND status IN ('accepted', 'declined'));

-- requester só pode cancelar o próprio pedido pendente.
CREATE POLICY "friendships_update_requester_cancel" ON public.friendships
FOR UPDATE TO authenticated
USING (requester_id = auth.uid() AND status = 'pending')
WITH CHECK (requester_id = auth.uid() AND status = 'cancelled');

-- moderador pode intervir (ex.: remover amizade em caso de abuso apurado).
CREATE POLICY "friendships_update_moderator" ON public.friendships
FOR UPDATE TO authenticated
USING (app_private.is_moderator(auth.uid()))
WITH CHECK (app_private.is_moderator(auth.uid()));

-- ============ selos de afinidade ============
-- Amizade, Confiança, Admiração, Parceria. Relação individual, sem média
-- pública, sem ranking, sem nota agregada (princípio de produto).
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT badges_kind_check CHECK (kind IN ('amizade', 'confianca', 'admiracao', 'parceria')),
  CONSTRAINT badges_not_self CHECK (giver_id <> receiver_id),
  UNIQUE (giver_id, receiver_id, kind)
);
GRANT SELECT, INSERT, DELETE ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "badges_select_visible" ON public.badges
FOR SELECT TO authenticated
USING (app_private.can_view_profile(auth.uid(), receiver_id));

CREATE POLICY "badges_insert_friends_only" ON public.badges
FOR INSERT TO authenticated
WITH CHECK (giver_id = auth.uid() AND app_private.are_friends(auth.uid(), receiver_id));

CREATE POLICY "badges_delete_own" ON public.badges
FOR DELETE TO authenticated USING (giver_id = auth.uid());

CREATE INDEX idx_friendships_addressee ON public.friendships (addressee_id, status);
CREATE INDEX idx_friendships_requester ON public.friendships (requester_id, status);
CREATE INDEX idx_badges_receiver ON public.badges (receiver_id, kind);
CREATE INDEX idx_blocks_blocker ON public.blocks (blocker_id);
