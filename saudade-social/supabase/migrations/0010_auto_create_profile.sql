-- ============================================================================
-- 0010 — criação automática de public.profiles após auth.users
-- ============================================================================
-- Diferente dos triggers removidos no item 5 da auditoria (que tentavam
-- REJEITAR um INSERT em auth.users/auth.sessions — comportamento sem
-- contrato oficial estável), este é o padrão AFTER INSERT amplamente
-- documentado pelo próprio Supabase para sincronizar auth.users com uma
-- tabela própria: só REAGE depois que o GoTrue já decidiu criar o usuário
-- (e já passou pelo Before User Created Hook da migration 0007), sem
-- interferir em nada do fluxo interno de autenticação. Risco bem menor,
-- por isso mantido como trigger direto.
CREATE OR REPLACE FUNCTION app_private.create_profile_for_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', 'Pessoa da Saudade Social')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_profile_for_new_user ON auth.users;
CREATE TRIGGER create_profile_for_new_user
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION app_private.create_profile_for_new_user();

-- NOTA: is_adult_confirmed nasce false por padrão (definido na migration
-- 0002) — a criação automática do profile nunca marca maioridade como
-- confirmada; isso só acontece na tela /confirmar-idade (Fase 2), igual
-- para e-mail e Google.
