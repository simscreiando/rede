import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/diretrizes")({
  component: DiretrizesPage,
});

function DiretrizesPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 prose">
      <h1>Diretrizes da Comunidade</h1>
      <p className="text-sm text-muted-foreground">
        Conteúdo pendente de redação — vai listar, entre outros pontos, os motivos de denúncia já
        modelados no banco (assédio, ameaça, discurso ilícito, exposição indevida, conteúdo
        sexual, fraude, impersonificação, direito autoral, privacidade, spam).
      </p>
    </div>
  );
}
