import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { BADGE_KINDS } from "@/lib/rede";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rede — rede social nostálgica, sem algoritmo" },
      {
        name: "description",
        content:
          "Perfis, comunidades, depoimentos e selos afetivos em uma rede social pequena e acolhedora. Sem ranking e sem feed algorítmico.",
      },
      { property: "og:title", content: "Rede — rede social nostálgica, sem algoritmo" },
      {
        property: "og:description",
        content:
          "Perfis, comunidades, depoimentos e selos afetivos em uma rede social pequena e acolhedora. Sem ranking e sem feed algorítmico.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://redesaudade.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://redesaudade.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              name: "Rede",
              url: "https://redesaudade.lovable.app",
              description:
                "Rede social nostálgica com perfis, comunidades, depoimentos e selos afetivos, sem ranking e sem feed algorítmico.",
              inLanguage: "pt-BR",
            },
            {
              "@type": "Organization",
              name: "Rede",
              url: "https://redesaudade.lovable.app",
              description:
                "Projeto de rede social de escala humana, com moderação humana e privacidade por padrão.",
            },
          ],
        }),
      },
    ],
  }),

  component: HomePage,
});

function HomePage() {
  const { user } = useAuth();

  return (
    <AppShell>
      <div className="space-y-10">
        <section className="paper-card p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            rede social de escala humana
          </p>
          <h1 className="mt-3 text-4xl leading-tight">
            A saudade daquela internet, com as regras de hoje.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground">
            Perfis com jeito de caderno, comunidades pequenas, recados no mural e depoimentos que só
            aparecem quando a pessoa homenageada aprova. Nada de ranking, nada de feed decidido por
            algoritmo, nada de publicidade que persegue você.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {user ? (
              <>
                <Button asChild>
                  <Link to="/perfil/$id" params={{ id: user.id }}>
                    Ir para meu perfil
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link to="/comunidades">Explorar comunidades</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild>
                  <Link to="/auth">Criar minha conta</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link to="/diretrizes">Ler as diretrizes</Link>
                </Button>
              </>
            )}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="paper-card p-6">
            <h2 className="text-lg">Selos afetivos, não estrelinhas</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Em vez de notas que criam ranking de reputação, amigos oferecem selos que reconhecem
              uma qualidade.
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              {BADGE_KINDS.map((badge) => (
                <li key={badge.value}>
                  {badge.emoji} {badge.label}
                </li>
              ))}
            </ul>
          </article>

          <article className="paper-card p-6">
            <h2 className="text-lg">Depoimentos com consentimento</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Quem recebe decide se publica, e pode remover quando quiser. O mural é seu, não do
              público.
            </p>
          </article>

          <article className="paper-card p-6">
            <h2 className="text-lg">Comunidades pequenas</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tópicos em ordem cronológica, regras combinadas por quem participa e possibilidade de
              manter sua participação privada.
            </p>
          </article>
        </section>

        <section className="paper-card p-6">
          <h2 className="text-lg">Como cuidamos das pessoas aqui</h2>
          <div className="mt-3 grid gap-4 text-sm text-muted-foreground md:grid-cols-2">
            <p>
              Toda denúncia passa por análise humana, com decisão justificada e direito de recurso.
              O histórico fica registrado para auditoria interna.
            </p>
            <p>
              Você exporta ou apaga seus dados quando quiser, em autoatendimento. Nesta fase a Rede é
              restrita a maiores de 18 anos.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild variant="secondary" size="sm">
              <Link to="/privacidade">Aviso de privacidade</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link to="/termos">Termos de uso</Link>
            </Button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
