// Server functions do closed beta gate.
//
// A garantia REAL de bloqueio de cadastro não autorizado é o Auth Hook
// oficial do Supabase ("Before User Created" — ver migration
// 0007_security_audit_fixes.sql e docs/BOOTSTRAP_ADMIN.md/README.md para
// como registrá-lo no projeto). Este arquivo não tenta mais pré-validar um
// e-mail antes do cadastro (checkEmailBetaAccess foi removida na auditoria
// de segurança: era um endpoint de enumeração — permitia descobrir quais
// e-mails estão autorizados testando um por um). O fluxo correto agora é:
// tentar o cadastro de verdade e tratar a rejeição do Auth Hook como um
// erro genérico ("acesso restrito"), sem confirmar nem negar o e-mail
// especificamente. Ver src/routes/auth.tsx.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Usado no beforeLoad de toda rota privada: reconfirma, a cada navegação,
 * que a sessão atual continua autorizada para o closed beta. Como não há
 * (na documentação oficial consultada) um Auth Hook que bloqueie emissão
 * de token para uma conta já revogada, esta reconfirmação por navegação é
 * o mecanismo real de enforcement de revogação — não um cookie de
 * autorização de longa duração, e não uma checagem só no momento do login.
 */
export const checkMyBetaAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: result, error } = await context.supabase.rpc("check_my_beta_access");
    if (error) throw new Error("Não foi possível verificar sua autorização agora.");
    return { authorized: Boolean(result) };
  });

/** Usado pela UI para decidir se mostra avisos/telas de closed beta. */
export const getBetaModeEnabled = createServerFn({ method: "GET" }).handler(async () => {
  const { data: result, error } = await supabaseAdmin.rpc("get_beta_mode_enabled");
  if (error) throw new Error("Não foi possível verificar o modo de acesso agora.");
  return { enabled: Boolean(result) };
});
