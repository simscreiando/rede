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

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_moderator(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('moderator', 'admin')
  )
$$;

CREATE POLICY "user_roles_select_own_or_moderator" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_moderator(auth.uid()));

-- ============ perfis ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Pessoa da Rede',
  username text UNIQUE,
  city text,
  bio text,
  avatar_url text,
  visibility text NOT NULL DEFAULT 'friends',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_visibility_check CHECK (visibility IN ('public', 'friends')),
  CONSTRAINT profiles_username_format CHECK (username IS NULL OR username ~ '^[a-z0-9_.]{3,24}$')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ amizades ============
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT friendships_status_check CHECK (status IN ('pending', 'accepted')),
  CONSTRAINT friendships_not_self CHECK (requester_id <> addressee_id),
  UNIQUE (requester_id, addressee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester_id = _a AND addressee_id = _b) OR (requester_id = _b AND addressee_id = _a))
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_profile(_viewer uuid, _profile uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _viewer = _profile
     OR public.are_friends(_viewer, _profile)
     OR EXISTS (SELECT 1 FROM public.profiles WHERE id = _profile AND visibility = 'public')
     OR public.is_moderator(_viewer)
$$;

CREATE POLICY "profiles_select_visible" ON public.profiles
FOR SELECT TO authenticated
USING (public.can_view_profile(auth.uid(), id));

CREATE POLICY "profiles_insert_own" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own" ON public.profiles
FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_delete_own" ON public.profiles
FOR DELETE TO authenticated USING (id = auth.uid());

CREATE POLICY "friendships_select_involved" ON public.friendships
FOR SELECT TO authenticated
USING (requester_id = auth.uid() OR addressee_id = auth.uid() OR status = 'accepted');

CREATE POLICY "friendships_insert_own_request" ON public.friendships
FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid());

CREATE POLICY "friendships_update_addressee" ON public.friendships
FOR UPDATE TO authenticated USING (addressee_id = auth.uid()) WITH CHECK (addressee_id = auth.uid());

CREATE POLICY "friendships_delete_involved" ON public.friendships
FOR DELETE TO authenticated
USING (requester_id = auth.uid() OR addressee_id = auth.uid());

-- ============ selos afetivos ============
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT badges_kind_check CHECK (kind IN ('amizade', 'admiracao', 'confianca', 'parceria')),
  CONSTRAINT badges_not_self CHECK (giver_id <> receiver_id),
  UNIQUE (giver_id, receiver_id, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "badges_select_visible" ON public.badges
FOR SELECT TO authenticated
USING (public.can_view_profile(auth.uid(), receiver_id));

CREATE POLICY "badges_insert_friends_only" ON public.badges
FOR INSERT TO authenticated
WITH CHECK (giver_id = auth.uid() AND public.are_friends(auth.uid(), receiver_id));

CREATE POLICY "badges_delete_own" ON public.badges
FOR DELETE TO authenticated USING (giver_id = auth.uid());

-- ============ depoimentos ============
CREATE TABLE public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CONSTRAINT testimonials_status_check CHECK (status IN ('pending', 'approved', 'removed')),
  CONSTRAINT testimonials_not_self CHECK (author_id <> profile_id),
  CONSTRAINT testimonials_body_len CHECK (char_length(body) BETWEEN 2 AND 2000)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.testimonials TO authenticated;
GRANT ALL ON public.testimonials TO service_role;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "testimonials_select_approved_or_involved" ON public.testimonials
FOR SELECT TO authenticated
USING (
  author_id = auth.uid()
  OR profile_id = auth.uid()
  OR public.is_moderator(auth.uid())
  OR (status = 'approved' AND public.can_view_profile(auth.uid(), profile_id))
);

CREATE POLICY "testimonials_insert_friends_only" ON public.testimonials
FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid() AND public.are_friends(auth.uid(), profile_id) AND status = 'pending');

CREATE POLICY "testimonials_update_owner_moderates" ON public.testimonials
FOR UPDATE TO authenticated USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

CREATE POLICY "testimonials_delete_author_or_owner" ON public.testimonials
FOR DELETE TO authenticated
USING (author_id = auth.uid() OR profile_id = auth.uid());

-- ============ recados ============
CREATE TABLE public.scraps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scraps_body_len CHECK (char_length(body) BETWEEN 1 AND 1000)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scraps TO authenticated;
GRANT ALL ON public.scraps TO service_role;
ALTER TABLE public.scraps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scraps_select_visible" ON public.scraps
FOR SELECT TO authenticated
USING (public.can_view_profile(auth.uid(), profile_id));

CREATE POLICY "scraps_insert_own" ON public.scraps
FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid() AND public.can_view_profile(auth.uid(), profile_id));

CREATE POLICY "scraps_delete_author_or_owner" ON public.scraps
FOR DELETE TO authenticated
USING (author_id = auth.uid() OR profile_id = auth.uid());

-- ============ comunidades ============
CREATE TABLE public.communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT communities_slug_format CHECK (slug ~ '^[a-z0-9-]{3,60}$'),
  CONSTRAINT communities_name_len CHECK (char_length(name) BETWEEN 3 AND 80)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communities TO authenticated;
GRANT ALL ON public.communities TO service_role;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "communities_select_all" ON public.communities
FOR SELECT TO authenticated USING (true);

CREATE POLICY "communities_insert_own" ON public.communities
FOR INSERT TO authenticated WITH CHECK (creator_id = auth.uid());

CREATE POLICY "communities_update_creator_or_moderator" ON public.communities
FOR UPDATE TO authenticated
USING (creator_id = auth.uid() OR public.is_moderator(auth.uid()))
WITH CHECK (creator_id = auth.uid() OR public.is_moderator(auth.uid()));

CREATE POLICY "communities_delete_creator_or_moderator" ON public.communities
FOR DELETE TO authenticated
USING (creator_id = auth.uid() OR public.is_moderator(auth.uid()));

CREATE TABLE public.community_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_private boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (community_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_members TO authenticated;
GRANT ALL ON public.community_members TO service_role;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_community_member(_user uuid, _community uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE user_id = _user AND community_id = _community
  )
$$;

CREATE POLICY "community_members_select_respect_privacy" ON public.community_members
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_moderator(auth.uid()) OR is_private = false);

CREATE POLICY "community_members_insert_own" ON public.community_members
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "community_members_update_own" ON public.community_members
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "community_members_delete_own" ON public.community_members
FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.community_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_topics_title_len CHECK (char_length(title) BETWEEN 3 AND 140)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_topics TO authenticated;
GRANT ALL ON public.community_topics TO service_role;
ALTER TABLE public.community_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_topics_select_all" ON public.community_topics
FOR SELECT TO authenticated USING (true);

CREATE POLICY "community_topics_insert_members" ON public.community_topics
FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid() AND public.is_community_member(auth.uid(), community_id));

CREATE POLICY "community_topics_delete_author_or_moderator" ON public.community_topics
FOR DELETE TO authenticated
USING (author_id = auth.uid() OR public.is_moderator(auth.uid()));

CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.community_topics(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_posts_body_len CHECK (char_length(body) BETWEEN 1 AND 4000)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT ALL ON public.community_posts TO service_role;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_posts_select_all" ON public.community_posts
FOR SELECT TO authenticated USING (true);

CREATE POLICY "community_posts_insert_own" ON public.community_posts
FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

CREATE POLICY "community_posts_delete_author_or_moderator" ON public.community_posts
FOR DELETE TO authenticated
USING (author_id = auth.uid() OR public.is_moderator(auth.uid()));

-- ============ denúncias e moderação ============
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reports_target_type_check CHECK (target_type IN ('profile', 'testimonial', 'scrap', 'community', 'topic', 'post')),
  CONSTRAINT reports_status_check CHECK (status IN ('open', 'reviewing', 'upheld', 'dismissed')),
  CONSTRAINT reports_reason_check CHECK (reason IN ('assedio', 'ameaca', 'discurso_ilicito', 'exposicao_indevida', 'conteudo_sexual', 'fraude', 'impersonificacao', 'direito_autoral', 'privacidade', 'spam', 'outro'))
);
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_select_own_or_moderator" ON public.reports
FOR SELECT TO authenticated
USING (reporter_id = auth.uid() OR public.is_moderator(auth.uid()));

CREATE POLICY "reports_insert_own" ON public.reports
FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "reports_update_moderator" ON public.reports
FOR UPDATE TO authenticated
USING (public.is_moderator(auth.uid())) WITH CHECK (public.is_moderator(auth.uid()));

CREATE TABLE public.moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  moderator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  justification text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT moderation_actions_justification_len CHECK (char_length(justification) >= 10)
);
GRANT SELECT, INSERT ON public.moderation_actions TO authenticated;
GRANT ALL ON public.moderation_actions TO service_role;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "moderation_actions_select_moderator" ON public.moderation_actions
FOR SELECT TO authenticated USING (public.is_moderator(auth.uid()));

CREATE POLICY "moderation_actions_insert_moderator" ON public.moderation_actions
FOR INSERT TO authenticated
WITH CHECK (moderator_id = auth.uid() AND public.is_moderator(auth.uid()));

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
FOR SELECT TO authenticated USING (public.is_moderator(auth.uid()));

CREATE POLICY "audit_log_insert_self" ON public.audit_log
FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

-- índices de leitura
CREATE INDEX idx_friendships_addressee ON public.friendships (addressee_id, status);
CREATE INDEX idx_friendships_requester ON public.friendships (requester_id, status);
CREATE INDEX idx_testimonials_profile ON public.testimonials (profile_id, status, created_at DESC);
CREATE INDEX idx_scraps_profile ON public.scraps (profile_id, created_at DESC);
CREATE INDEX idx_badges_receiver ON public.badges (receiver_id, kind);
CREATE INDEX idx_community_members_community ON public.community_members (community_id);
CREATE INDEX idx_community_topics_community ON public.community_topics (community_id, created_at DESC);
CREATE INDEX idx_community_posts_topic ON public.community_posts (topic_id, created_at);
CREATE INDEX idx_reports_status ON public.reports (status, created_at DESC);