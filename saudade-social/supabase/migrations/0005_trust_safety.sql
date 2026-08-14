-- ============================================================================
-- 0005 — Denúncias e moderação
-- ============================================================================
-- A spec exige que uma linha em moderation_actions NÃO seja tratada como se
-- a medida já tivesse sido executada. Por isso a função abaixo
-- (apply_moderation_action) registra a decisão E, na mesma transação,
-- aplica o efeito real definido para cada tipo de ação — hoje apenas
-- "remove_content" (marca o conteúdo denunciado como removido/oculto).
-- Ações de suspensão de conta ficam fora do escopo desta fase (não
-- inventar funcionalidade não especificada) e serão adicionadas quando o
-- modelo de suspensão for definido.

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
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_select_own_or_moderator" ON public.reports
FOR SELECT TO authenticated
USING (reporter_id = auth.uid() OR app_private.is_moderator(auth.uid()));

CREATE POLICY "reports_insert_own" ON public.reports
FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());

-- Sem policy de UPDATE direta: mudança de status só acontece dentro de
-- apply_moderation_action, junto com o registro da ação e a execução dela.

CREATE TABLE public.moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  moderator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  justification text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT moderation_actions_action_check CHECK (action IN ('remove_content', 'dismiss', 'warn_only')),
  CONSTRAINT moderation_actions_justification_len CHECK (char_length(justification) >= 10)
);
GRANT SELECT ON public.moderation_actions TO authenticated;
GRANT ALL ON public.moderation_actions TO service_role;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "moderation_actions_select_moderator" ON public.moderation_actions
FOR SELECT TO authenticated USING (app_private.is_moderator(auth.uid()));

-- Coluna auxiliar de "removido por moderação" nos conteúdos moderáveis, para
-- a execução real da ação "remove_content" ter algo concreto para marcar.
ALTER TABLE public.testimonials ADD COLUMN removed_by_moderation boolean NOT NULL DEFAULT false;
ALTER TABLE public.scraps ADD COLUMN removed_by_moderation boolean NOT NULL DEFAULT false;
ALTER TABLE public.community_topics ADD COLUMN removed_by_moderation boolean NOT NULL DEFAULT false;
ALTER TABLE public.community_posts ADD COLUMN removed_by_moderation boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.apply_moderation_action(
  _report_id uuid,
  _action text,
  _justification text
)
RETURNS public.moderation_actions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _report public.reports;
  _row public.moderation_actions;
BEGIN
  IF NOT app_private.is_moderator(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas moderadores podem aplicar medidas';
  END IF;

  SELECT * INTO _report FROM public.reports WHERE id = _report_id FOR UPDATE;
  IF _report IS NULL THEN
    RAISE EXCEPTION 'Denúncia não encontrada';
  END IF;

  INSERT INTO public.moderation_actions (report_id, moderator_id, action, justification)
  VALUES (_report_id, auth.uid(), _action, _justification)
  RETURNING * INTO _row;

  -- Execução real da medida, não apenas registro:
  IF _action = 'remove_content' THEN
    CASE _report.target_type
      WHEN 'testimonial' THEN
        UPDATE public.testimonials SET removed_by_moderation = true, status = 'removed' WHERE id = _report.target_id;
      WHEN 'scrap' THEN
        UPDATE public.scraps SET removed_by_moderation = true WHERE id = _report.target_id;
      WHEN 'topic' THEN
        UPDATE public.community_topics SET removed_by_moderation = true WHERE id = _report.target_id;
      WHEN 'post' THEN
        UPDATE public.community_posts SET removed_by_moderation = true WHERE id = _report.target_id;
      ELSE
        RAISE EXCEPTION 'remove_content não é aplicável a target_type=%', _report.target_type;
    END CASE;
  END IF;

  UPDATE public.reports
  SET status = CASE WHEN _action = 'dismiss' THEN 'dismissed' ELSE 'upheld' END
  WHERE id = _report_id;

  INSERT INTO public.audit_log (actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'moderation_action_applied', _report.target_type, _report.target_id,
          jsonb_build_object('report_id', _report_id, 'action', _action));

  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_moderation_action(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_moderation_action(uuid, text, text) TO authenticated;

-- Conteúdo marcado como removed_by_moderation deixa de ser visível a quem
-- não é moderador (mesmo que a policy de SELECT original permitisse).
DROP POLICY IF EXISTS "testimonials_select_approved_or_involved" ON public.testimonials;
CREATE POLICY "testimonials_select_approved_or_involved" ON public.testimonials
FOR SELECT TO authenticated
USING (
  app_private.is_moderator(auth.uid())
  OR (
    NOT removed_by_moderation
    AND (
      author_id = auth.uid()
      OR profile_id = auth.uid()
      OR (status = 'approved' AND app_private.can_view_profile(auth.uid(), profile_id))
    )
  )
);

DROP POLICY IF EXISTS "scraps_select_visible" ON public.scraps;
CREATE POLICY "scraps_select_visible" ON public.scraps
FOR SELECT TO authenticated
USING (
  app_private.is_moderator(auth.uid())
  OR (NOT removed_by_moderation AND app_private.can_view_profile(auth.uid(), profile_id))
);

DROP POLICY IF EXISTS "community_topics_select_members_or_open" ON public.community_topics;
CREATE POLICY "community_topics_select_members_or_open" ON public.community_topics
FOR SELECT TO authenticated
USING (
  app_private.is_moderator(auth.uid())
  OR (
    NOT removed_by_moderation
    AND (
      EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND c.is_open)
      OR app_private.is_community_member(auth.uid(), community_id)
    )
  )
);

DROP POLICY IF EXISTS "community_posts_select_members_or_open" ON public.community_posts;
CREATE POLICY "community_posts_select_members_or_open" ON public.community_posts
FOR SELECT TO authenticated
USING (
  app_private.is_moderator(auth.uid())
  OR (
    NOT removed_by_moderation
    AND EXISTS (
      SELECT 1
      FROM public.community_topics t
      JOIN public.communities c ON c.id = t.community_id
      WHERE t.id = topic_id
        AND (c.is_open OR app_private.is_community_member(auth.uid(), c.id))
    )
  )
);

CREATE INDEX idx_reports_status ON public.reports (status, created_at DESC);
CREATE INDEX idx_moderation_actions_report ON public.moderation_actions (report_id);
