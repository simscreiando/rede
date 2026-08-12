DROP POLICY IF EXISTS friendships_select_involved ON public.friendships;

CREATE POLICY friendships_select_involved
ON public.friendships
FOR SELECT
TO authenticated
USING ((requester_id = auth.uid()) OR (addressee_id = auth.uid()) OR app_private.is_moderator(auth.uid()));