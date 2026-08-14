import { describe, expect, it } from "vitest";
import { buildCallbackUrl } from "@/lib/env";

describe("buildCallbackUrl", () => {
  it("monta a URL de callback sem barra duplicada quando PUBLIC_APP_URL termina em /", () => {
    expect(buildCallbackUrl("https://saudade.social/")).toBe("https://saudade.social/auth/callback");
  });

  it("monta a URL de callback normalmente quando PUBLIC_APP_URL não termina em /", () => {
    expect(buildCallbackUrl("https://saudade.social")).toBe("https://saudade.social/auth/callback");
  });

  it("funciona com localhost (ambiente de desenvolvimento)", () => {
    expect(buildCallbackUrl("http://localhost:3000")).toBe("http://localhost:3000/auth/callback");
  });
});
