import { createStart } from "@tanstack/react-start";

// Nenhum middleware global de auth é necessário aqui: com sessão baseada em
// cookies (ver ssr-client.ts), o navegador já envia o cookie de sessão
// automaticamente em toda chamada de server function — não existe mais um
// Bearer token para anexar manualmente (era o que attachSupabaseAuth fazia
// na Fase 0, removido na correção pós-auditoria).
export const startInstance = createStart(() => ({}));
