import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 prose">
      <h1>Política de Privacidade</h1>
      <p className="text-sm text-muted-foreground">
        Conteúdo pendente de redação/revisão jurídica. Este texto não deve ser tratado como a
        política de privacidade final da Saudade Social — ver ambiguidade 3 do diagnóstico
        (retenção de dados na exclusão de conta) para o que ainda precisa ser decidido antes de
        publicar um texto definitivo.
      </p>
    </div>
  );
}
