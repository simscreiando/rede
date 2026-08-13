CREATE TABLE public.invited_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  note text,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX invited_emails_email_key ON public.invited_emails (lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invited_emails TO authenticated;
GRANT ALL ON public.invited_emails TO service_role;

ALTER TABLE public.invited_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invited_emails_select_own_or_moderator"
ON public.invited_emails FOR SELECT TO authenticated
USING (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  OR app_private.is_moderator(auth.uid())
);

CREATE POLICY "invited_emails_insert_moderator"
ON public.invited_emails FOR INSERT TO authenticated
WITH CHECK (app_private.is_moderator(auth.uid()));

CREATE POLICY "invited_emails_update_moderator"
ON public.invited_emails FOR UPDATE TO authenticated
USING (app_private.is_moderator(auth.uid()))
WITH CHECK (app_private.is_moderator(auth.uid()));

CREATE POLICY "invited_emails_delete_moderator"
ON public.invited_emails FOR DELETE TO authenticated
USING (app_private.is_moderator(auth.uid()));

CREATE TRIGGER invited_emails_set_updated_at
BEFORE UPDATE ON public.invited_emails
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "communities_select_all" ON public.communities;

CREATE POLICY "communities_select_visible"
ON public.communities FOR SELECT TO authenticated
USING (
  is_open
  OR app_private.is_community_member(auth.uid(), id)
  OR app_private.is_moderator(auth.uid())
);