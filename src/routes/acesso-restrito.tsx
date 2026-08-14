import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/acesso-restrito")({
  component: AcessoRestritoPage,
});

function AcessoRestritoPage() {
  const { signOut } = useAuth();

  return (
    <div className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold mb-4">Este acesso está restrito</h1>
      <p className="text-muted-foreground mb-8">
        A Saudade Social ainda está em fase de testes fechados. Sua conta entrou com sucesso, mas
        este e-mail não está (ou não está mais) autorizado a acessar a aplicação nesta fase. Se
        você foi convidado, confirme se usou o mesmo e-mail do convite.
      </p>
      <button
        type="button"
        onClick={() => void signOut()}
        className="text-sm underline text-muted-foreground"
      >
        Sair
      </button>
    </div>
  );
}
