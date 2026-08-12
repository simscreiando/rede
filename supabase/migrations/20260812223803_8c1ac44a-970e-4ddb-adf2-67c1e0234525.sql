-- 1. Private schema for internal SECURITY DEFINER helpers (not exposed via the API)
CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION app_private.is_moderator(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('moderator', 'admin')
  )
$$;

CREATE OR REPLACE FUNCTION app_private.are_friends(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester_id = _a AND addressee_id = _b) OR (requester_id = _b AND addressee_id = _a))
  )
$$;

CREATE OR REPLACE FUNCTION app_private.can_view_profile(_viewer uuid, _profile uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _viewer = _profile
     OR app_private.are_friends(_viewer, _profile)
     OR EXISTS (SELECT 1 FROM public.profiles WHERE id = _profile AND visibility = 'public')
     OR app_private.is_moderator(_viewer)
$$;

CREATE OR REPLACE FUNCTION app_private.is_community_member(_user uuid, _community uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE user_id = _user AND community_id = _community
  )
$$;

REVOKE ALL ON FUNCTION app_private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.is_moderator(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.are_friends(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.can_view_profile(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.is_community_member(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.is_moderator(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.are_friends(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.can_view_profile(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.is_community_member(uuid, uuid) TO authenticated, service_role;

-- 2. Communities gain an explicit openness flag (existing ones stay open)
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS is_open boolean NOT NULL DEFAULT true;

-- 3. Recreate every policy that referenced the public helpers
-- profiles
DROP POLICY IF EXISTS profiles_select_visible ON public.profiles;
CREATE POLICY profiles_select_visible ON public.profiles FOR SELECT TO authenticated
  USING (app_private.can_view_profile(auth.uid(), id));

-- badges
DROP POLICY IF EXISTS badges_select_visible ON public.badges;
CREATE POLICY badges_select_visible ON public.badges FOR SELECT TO authenticated
  USING (app_private.can_view_profile(auth.uid(), receiver_id));
DROP POLICY IF EXISTS badges_insert_friends_only ON public.badges;
CREATE POLICY badges_insert_friends_only ON public.badges FOR INSERT TO authenticated
  WITH CHECK (giver_id = auth.uid() AND app_private.are_friends(auth.uid(), receiver_id));

-- scraps
DROP POLICY IF EXISTS scraps_select_visible ON public.scraps;
CREATE POLICY scraps_select_visible ON public.scraps FOR SELECT TO authenticated
  USING (app_private.can_view_profile(auth.uid(), profile_id));
DROP POLICY IF EXISTS scraps_insert_own ON public.scraps;
CREATE POLICY scraps_insert_own ON public.scraps FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND app_private.can_view_profile(auth.uid(), profile_id));

-- testimonials
DROP POLICY IF EXISTS testimonials_select_approved_or_involved ON public.testimonials;
CREATE POLICY testimonials_select_approved_or_involved ON public.testimonials FOR SELECT TO authenticated
  USING (
    author_id = auth.uid()
    OR profile_id = auth.uid()
    OR app_private.is_moderator(auth.uid())
    OR (status = 'approved' AND app_private.can_view_profile(auth.uid(), profile_id))
  );
DROP POLICY IF EXISTS testimonials_insert_friends_only ON public.testimonials;
CREATE POLICY testimonials_insert_friends_only ON public.testimonials FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND app_private.are_friends(auth.uid(), profile_id) AND status = 'pending');

-- audit_log
DROP POLICY IF EXISTS audit_log_select_moderator ON public.audit_log;
CREATE POLICY audit_log_select_moderator ON public.audit_log FOR SELECT TO authenticated
  USING (app_private.is_moderator(auth.uid()));

-- reports
DROP POLICY IF EXISTS reports_select_own_or_moderator ON public.reports;
CREATE POLICY reports_select_own_or_moderator ON public.reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR app_private.is_moderator(auth.uid()));
DROP POLICY IF EXISTS reports_update_moderator ON public.reports;
CREATE POLICY reports_update_moderator ON public.reports FOR UPDATE TO authenticated
  USING (app_private.is_moderator(auth.uid())) WITH CHECK (app_private.is_moderator(auth.uid()));

-- moderation_actions
DROP POLICY IF EXISTS moderation_actions_select_moderator ON public.moderation_actions;
CREATE POLICY moderation_actions_select_moderator ON public.moderation_actions FOR SELECT TO authenticated
  USING (app_private.is_moderator(auth.uid()));
DROP POLICY IF EXISTS moderation_actions_insert_moderator ON public.moderation_actions;
CREATE POLICY moderation_actions_insert_moderator ON public.moderation_actions FOR INSERT TO authenticated
  WITH CHECK (moderator_id = auth.uid() AND app_private.is_moderator(auth.uid()));

-- user_roles
DROP POLICY IF EXISTS user_roles_select_own_or_moderator ON public.user_roles;
CREATE POLICY user_roles_select_own_or_moderator ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR app_private.is_moderator(auth.uid()));

-- communities
DROP POLICY IF EXISTS communities_update_creator_or_moderator ON public.communities;
CREATE POLICY communities_update_creator_or_moderator ON public.communities FOR UPDATE TO authenticated
  USING (creator_id = auth.uid() OR app_private.is_moderator(auth.uid()))
  WITH CHECK (creator_id = auth.uid() OR app_private.is_moderator(auth.uid()));
DROP POLICY IF EXISTS communities_delete_creator_or_moderator ON public.communities;
CREATE POLICY communities_delete_creator_or_moderator ON public.communities FOR DELETE TO authenticated
  USING (creator_id = auth.uid() OR app_private.is_moderator(auth.uid()));

-- community_members
DROP POLICY IF EXISTS community_members_select_respect_privacy ON public.community_members;
CREATE POLICY community_members_select_respect_privacy ON public.community_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR app_private.is_moderator(auth.uid()) OR is_private = false);

-- 4. Community content: gate reads of closed communities to members/moderators
DROP POLICY IF EXISTS community_topics_select_all ON public.community_topics;
CREATE POLICY community_topics_select_members_or_open ON public.community_topics FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND c.is_open)
    OR app_private.is_community_member(auth.uid(), community_id)
    OR app_private.is_moderator(auth.uid())
  );

DROP POLICY IF EXISTS community_topics_insert_members ON public.community_topics;
CREATE POLICY community_topics_insert_members ON public.community_topics FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND app_private.is_community_member(auth.uid(), community_id));

DROP POLICY IF EXISTS community_topics_delete_author_or_moderator ON public.community_topics;
CREATE POLICY community_topics_delete_author_or_moderator ON public.community_topics FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR app_private.is_moderator(auth.uid()));

CREATE POLICY community_topics_update_moderator ON public.community_topics FOR UPDATE TO authenticated
  USING (app_private.is_moderator(auth.uid())) WITH CHECK (app_private.is_moderator(auth.uid()));

DROP POLICY IF EXISTS community_posts_select_all ON public.community_posts;
CREATE POLICY community_posts_select_members_or_open ON public.community_posts FOR SELECT TO authenticated
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

DROP POLICY IF EXISTS community_posts_delete_author_or_moderator ON public.community_posts;
CREATE POLICY community_posts_delete_author_or_moderator ON public.community_posts FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR app_private.is_moderator(auth.uid()));

CREATE POLICY community_posts_update_moderator ON public.community_posts FOR UPDATE TO authenticated
  USING (app_private.is_moderator(auth.uid())) WITH CHECK (app_private.is_moderator(auth.uid()));

-- 5. Lock immutable columns on community_members updates (only is_private may change)
CREATE OR REPLACE FUNCTION app_private.lock_community_member_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.community_id <> OLD.community_id OR NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'community_id and user_id cannot be changed';
  END IF;
  NEW.created_at = OLD.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_members_lock_identity ON public.community_members;
CREATE TRIGGER community_members_lock_identity
  BEFORE UPDATE ON public.community_members
  FOR EACH ROW EXECUTE FUNCTION app_private.lock_community_member_identity();

-- 6. Remove the publicly exposed helper functions
DROP FUNCTION IF EXISTS public.can_view_profile(uuid, uuid);
DROP FUNCTION IF EXISTS public.are_friends(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_community_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_moderator(uuid);
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);