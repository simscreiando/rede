-- ============================================================================
-- 0004 — Comunidades, tópicos e respostas
-- ============================================================================
-- Decisão provisória 14.6: comunidade aberta = entrada imediata;
-- comunidade fechada = entrada só por convite/aprovação explícita do
-- administrador (fluxo de aprovação em si fica para uma fase futura — aqui
-- só a entrada direta em comunidade aberta está implementada; entrar em
-- fechada exige is_open=false ficar reservado para quando o convite/
-- aprovação existir de fato, para não fingir uma funcionalidade que ainda
-- não existe).
-- Decisão provisória 14.7: o criador da comunidade é o administrador dela
-- (community_admin), separado do papel de moderador global.

CREATE TABLE public.communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT communities_slug_format CHECK (slug ~ '^[a-z0-9-]{3,60}$'),
  CONSTRAINT communities_name_len CHECK (char_length(name) BETWEEN 3 AND 80)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communities TO authenticated;
GRANT ALL ON public.communities TO service_role;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.community_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (community_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.community_members TO authenticated;
GRANT ALL ON public.community_members TO service_role;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION app_private.is_community_member(_user uuid, _community uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE user_id = _user AND community_id = _community
  )
$$;
REVOKE ALL ON FUNCTION app_private.is_community_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.is_community_member(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.is_community_admin(_user uuid, _community uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.communities WHERE id = _community AND creator_id = _user
  )
$$;
REVOKE ALL ON FUNCTION app_private.is_community_admin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.is_community_admin(uuid, uuid) TO authenticated, service_role;

CREATE POLICY "communities_select_visible" ON public.communities
FOR SELECT TO authenticated
USING (
  is_open
  OR app_private.is_community_member(auth.uid(), id)
  OR app_private.is_moderator(auth.uid())
);

CREATE POLICY "communities_insert_own" ON public.communities
FOR INSERT TO authenticated WITH CHECK (creator_id = auth.uid());

CREATE POLICY "communities_update_creator_or_moderator" ON public.communities
FOR UPDATE TO authenticated
USING (creator_id = auth.uid() OR app_private.is_moderator(auth.uid()))
WITH CHECK (creator_id = auth.uid() OR app_private.is_moderator(auth.uid()));

CREATE POLICY "communities_delete_creator_or_moderator" ON public.communities
FOR DELETE TO authenticated
USING (creator_id = auth.uid() OR app_private.is_moderator(auth.uid()));

CREATE POLICY "community_members_select_respect_privacy" ON public.community_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR app_private.is_moderator(auth.uid())
  OR EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND c.is_open)
);

-- Entrada direta só é permitida em comunidade aberta. Entrada em comunidade
-- fechada fica bloqueada até o fluxo de convite/aprovação existir de fato
-- (ver nota de escopo no topo do arquivo) — assim a RLS nunca finge
-- permitir algo que a aplicação ainda não implementa de verdade.
CREATE POLICY "community_members_insert_own_open_only" ON public.community_members
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND c.is_open)
);

CREATE POLICY "community_members_delete_own_or_admin" ON public.community_members
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR app_private.is_community_admin(auth.uid(), community_id)
  OR app_private.is_moderator(auth.uid())
);

CREATE TABLE public.community_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_topics_title_len CHECK (char_length(title) BETWEEN 3 AND 140)
);
GRANT SELECT, INSERT, DELETE ON public.community_topics TO authenticated;
GRANT ALL ON public.community_topics TO service_role;
ALTER TABLE public.community_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_topics_select_members_or_open" ON public.community_topics
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND c.is_open)
  OR app_private.is_community_member(auth.uid(), community_id)
  OR app_private.is_moderator(auth.uid())
);

CREATE POLICY "community_topics_insert_members" ON public.community_topics
FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid() AND app_private.is_community_member(auth.uid(), community_id));

CREATE POLICY "community_topics_delete_author_or_moderator" ON public.community_topics
FOR DELETE TO authenticated
USING (
  author_id = auth.uid()
  OR app_private.is_community_admin(auth.uid(), community_id)
  OR app_private.is_moderator(auth.uid())
);

CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.community_topics(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_posts_body_len CHECK (char_length(body) BETWEEN 1 AND 4000)
);
GRANT SELECT, INSERT, DELETE ON public.community_posts TO authenticated;
GRANT ALL ON public.community_posts TO service_role;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_posts_select_members_or_open" ON public.community_posts
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.community_topics t
    JOIN public.communities c ON c.id = t.community_id
    WHERE t.id = topic_id
      AND (
        c.is_open
        OR app_private.is_community_member(auth.uid(), c.id)
        OR app_private.is_moderator(auth.uid())
      )
  )
);

-- CORREÇÃO DO BUG P1 DA AUDITORIA: a versão anterior só verificava
-- author_id = auth.uid() aqui, permitindo responder em qualquer tópico
-- mesmo sem ser membro da comunidade. Agora a política resolve o
-- community_id a partir do tópico e exige membership nele.
CREATE POLICY "community_posts_insert_members_only" ON public.community_posts
FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.community_topics t
    WHERE t.id = topic_id
      AND app_private.is_community_member(auth.uid(), t.community_id)
  )
);

CREATE POLICY "community_posts_delete_author_or_moderator" ON public.community_posts
FOR DELETE TO authenticated
USING (
  author_id = auth.uid()
  OR app_private.is_moderator(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.community_topics t
    WHERE t.id = topic_id AND app_private.is_community_admin(auth.uid(), t.community_id)
  )
);

CREATE INDEX idx_community_members_community ON public.community_members (community_id);
CREATE INDEX idx_community_topics_community ON public.community_topics (community_id, created_at DESC);
CREATE INDEX idx_community_posts_topic ON public.community_posts (topic_id, created_at);
