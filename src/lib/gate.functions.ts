import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

type GateSession = { unlocked?: boolean };

function sessionConfig() {
  const password = process.env["SESSION_SECRET"];
  if (!password) throw new Error("SESSION_SECRET is not set");
  return {
    password,
    name: "rede-gate",
    maxAge: 60 * 60 * 24 * 7,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

// Equal-length digests: timingSafeEqual throws on length mismatch, and the raw
// length itself would leak through timing.
function passwordMatches(input: string, expected: string) {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export const isSiteUnlocked = createServerFn({ method: "GET" }).handler(async () => {
  if (!process.env["SITE_PASSWORD"]) {
    // Sem senha configurada, o portão fica aberto para não trancar o projeto fora.
    return { unlocked: true, configured: false };
  }
  const session = await useSession<GateSession>(sessionConfig());
  return { unlocked: session.data.unlocked === true, configured: true };
});

export const unlockSite = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => ({
    password: String(data?.password ?? "").slice(0, 200),
  }))
  .handler(async ({ data }) => {
    const expected = process.env["SITE_PASSWORD"];
    if (!expected) return { ok: true as const };
    if (!passwordMatches(data.password, expected)) {
      return { ok: false as const };
    }
    const session = await useSession<GateSession>(sessionConfig());
    await session.update({ unlocked: true });
    return { ok: true as const };
  });

export const lockSite = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<GateSession>(sessionConfig());
  await session.clear();
  return { ok: true as const };
});
