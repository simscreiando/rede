import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  component: TermosPage,
});

function TermosPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 prose">
      <h1>Termos de Uso</h1>
      <p className="text-sm text-muted-foreground">
        Conteúdo pendente de redação/revisão jurídica — mesma ressalva da página de Privacidade.
      </p>
    </div>
  );
}
