import { auth } from "@/auth";
import { DomainError } from "@/lib/errors";

export async function currentUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new DomainError("Autenticacao necessaria.", 401);
  return session.user.id;
}

export function apiError(error: unknown) {
  if (error instanceof DomainError) return Response.json({ error: error.message }, { status: error.status });
  console.error(error);
  return Response.json({ error: "Erro interno." }, { status: 500 });
}
