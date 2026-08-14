-- ============================================================================
-- 0009 — Regra 18+ única, aplicada no banco
-- ============================================================================
-- Achado da auditoria (item 7 do prompt): a regra 18+ não pode existir só
-- no formulário de cadastro por e-mail, porque isso deixaria o Google OAuth
-- como caminho alternativo sem essa exigência. A correção INTENCIONAL não é
-- adicionar um checkbox equivalente na tela de Google (o consentimento do
-- Google não tem esse campo) — é fazer a confirmação de maioridade ser um
-- passo pós-autenticação, idêntico para os dois provedores, e travar no
-- banco qualquer ação social até essa confirmação existir. Isso garante que
-- a regra é "única" de verdade: não existe caminho de escrita relevante que
-- não passe por aqui, independente da tela que a pessoa usou para entrar.
--
-- profiles.is_adult_confirmed já existia desde a migration 0002 (default
-- false). O que faltava era efetivamente EXIGIR essa flag antes de permitir
-- as ações sociais que fazem sentido só depois da confirmação.

CREATE OR REPLACE FUNCTION app_private.is_adult_confirmed(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_adult_confirmed FROM public.profiles WHERE id = _user_id), false)
$$;
REVOKE ALL ON FUNCTION app_private.is_adult_confirmed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.is_adult_confirmed(uuid) TO authenticated, service_role;

-- friendships: já exigia requester_id = auth.uid(); soma a exigência de
-- maioridade confirmada antes de iniciar relações sociais.
DROP POLICY IF EXISTS "friendships_insert_own_request" ON public.friendships;
CREATE POLICY "friendships_insert_own_request" ON public.friendships
FOR INSERT TO authenticated
WITH CHECK (
  requester_id = auth.uid()
  AND status = 'pending'
  AND app_private.is_adult_confirmed(auth.uid())
  AND NOT app_private.is_blocked(auth.uid(), addressee_id)
);

DROP POLICY IF EXISTS "badges_insert_friends_only" ON public.badges;
CREATE POLICY "badges_insert_friends_only" ON public.badges
FOR INSERT TO authenticated
WITH CHECK (
  giver_id = auth.uid()
  AND app_private.is_adult_confirmed(auth.uid())
  AND app_private.are_friends(auth.uid(), receiver_id)
);

DROP POLICY IF EXISTS "testimonials_insert_friends_only" ON public.testimonials;
CREATE POLICY "testimonials_insert_friends_only" ON public.testimonials
FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND status = 'pending'
  AND app_private.is_adult_confirmed(auth.uid())
  AND app_private.are_friends(auth.uid(), profile_id)
);

DROP POLICY IF EXISTS "scraps_insert_own" ON public.scraps;
CREATE POLICY "scraps_insert_own" ON public.scraps
FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND app_private.is_adult_confirmed(auth.uid())
  AND app_private.can_view_profile(auth.uid(), profile_id)
  AND NOT app_private.is_blocked(auth.uid(), profile_id)
);

DROP POLICY IF EXISTS "communities_insert_own" ON public.communities;
CREATE POLICY "communities_insert_own" ON public.communities
FOR INSERT TO authenticated
WITH CHECK (creator_id = auth.uid() AND app_private.is_adult_confirmed(auth.uid()));

DROP POLICY IF EXISTS "community_topics_insert_members" ON public.community_topics;
CREATE POLICY "community_topics_insert_members" ON public.community_topics
FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND app_private.is_adult_confirmed(auth.uid())
  AND app_private.is_community_member(auth.uid(), community_id)
);

DROP POLICY IF EXISTS "community_posts_insert_members_only" ON public.community_posts;
CREATE POLICY "community_posts_insert_members_only" ON public.community_posts
FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND app_private.is_adult_confirmed(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.community_topics t
    WHERE t.id = topic_id
      AND app_private.is_community_member(auth.uid(), t.community_id)
  )
);

-- community_members: entrar em comunidade aberta também passa a exigir
-- maioridade confirmada (mesma lógica).
DROP POLICY IF EXISTS "community_members_insert_own_open_only" ON public.community_members;
CREATE POLICY "community_members_insert_own_open_only" ON public.community_members
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND app_private.is_adult_confirmed(auth.uid())
  AND EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND c.is_open)
);

-- NOTA: leitura (SELECT) nunca é bloqueada por is_adult_confirmed — a
-- pessoa pode navegar e ver conteúdo (sujeito às regras normais de
-- visibilidade/membership) antes de confirmar maioridade; o que fica
-- bloqueado é PARTICIPAR (criar amizade, depoimento, recado, comunidade,
-- tópico, resposta, selo, entrada em comunidade). A tela de confirmação de
-- 18+ em si (Fase 2) é a única ação disponível para quem ainda não
-- confirmou, além de navegação/leitura e logout.
