-- ============================================================================
-- 0003 — Depoimentos e recados
-- ============================================================================

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
-- Propositalmente SEM GRANT UPDATE para authenticated: a única forma de
-- mudar o status é a função set_testimonial_status abaixo. Isso corrige o
-- bug encontrado no projeto anterior, em que o titular podia sobrescrever
-- author_id/body via um UPDATE comum.
GRANT SELECT, INSERT, DELETE ON public.testimonials TO authenticated;
GRANT ALL ON public.testimonials TO service_role;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "testimonials_select_approved_or_involved" ON public.testimonials
FOR SELECT TO authenticated
USING (
  author_id = auth.uid()
  OR profile_id = auth.uid()
  OR app_private.is_moderator(auth.uid())
  OR (status = 'approved' AND app_private.can_view_profile(auth.uid(), profile_id))
);

CREATE POLICY "testimonials_insert_friends_only" ON public.testimonials
FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND status = 'pending'
  AND app_private.are_friends(auth.uid(), profile_id)
);

CREATE POLICY "testimonials_delete_author_or_owner" ON public.testimonials
FOR DELETE TO authenticated
USING (author_id = auth.uid() OR profile_id = auth.uid() OR app_private.is_moderator(auth.uid()));

-- Único caminho para mudar status: o titular do perfil aprova ou remove;
-- o autor original não decide publicação. Nunca altera author_id/body.
CREATE OR REPLACE FUNCTION public.set_testimonial_status(_testimonial_id uuid, _new_status text)
RETURNS public.testimonials
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _row public.testimonials;
BEGIN
  IF _new_status NOT IN ('approved', 'removed') THEN
    RAISE EXCEPTION 'Status inválido: %', _new_status;
  END IF;

  SELECT * INTO _row FROM public.testimonials WHERE id = _testimonial_id FOR UPDATE;
  IF _row IS NULL THEN
    RAISE EXCEPTION 'Depoimento não encontrado';
  END IF;

  IF _row.profile_id <> auth.uid() AND NOT app_private.is_moderator(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para alterar este depoimento';
  END IF;

  UPDATE public.testimonials
  SET status = _new_status, reviewed_at = now()
  WHERE id = _testimonial_id
  RETURNING * INTO _row;

  INSERT INTO public.audit_log (actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'testimonial_status_changed', 'testimonial', _testimonial_id,
          jsonb_build_object('new_status', _new_status));

  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.set_testimonial_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_testimonial_status(uuid, text) TO authenticated;

-- ============ recados ============
CREATE TABLE public.scraps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scraps_body_len CHECK (char_length(body) BETWEEN 1 AND 1000)
);
GRANT SELECT, INSERT, DELETE ON public.scraps TO authenticated;
GRANT ALL ON public.scraps TO service_role;
ALTER TABLE public.scraps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scraps_select_visible" ON public.scraps
FOR SELECT TO authenticated
USING (app_private.can_view_profile(auth.uid(), profile_id));

CREATE POLICY "scraps_insert_own" ON public.scraps
FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND app_private.can_view_profile(auth.uid(), profile_id)
  AND NOT app_private.is_blocked(auth.uid(), profile_id)
);

CREATE POLICY "scraps_delete_author_or_owner" ON public.scraps
FOR DELETE TO authenticated
USING (author_id = auth.uid() OR profile_id = auth.uid() OR app_private.is_moderator(auth.uid()));

CREATE INDEX idx_testimonials_profile ON public.testimonials (profile_id, status, created_at DESC);
CREATE INDEX idx_scraps_profile ON public.scraps (profile_id, created_at DESC);
