import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold mb-4">A saudade daquela internet,</h1>
      <p className="text-xl text-muted-foreground mb-8">com as regras de hoje.</p>
      <p className="text-sm text-muted-foreground">
        Esta é a fundação técnica da Saudade Social (Fase 0). A tela de entrada, o cadastro, o
        login com Google e o restante da experiência chegam nas próximas fases.
      </p>
    </div>
  );
}
