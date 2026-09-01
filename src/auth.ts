import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Credentials({
    name: "Local development",
    credentials: { email: { label: "E-mail", type: "email" }, name: { label: "Nome", type: "text" } },
    async authorize(credentials) {
      const parsed = z.object({ email: z.string().email(), name: z.string().trim().min(1).max(80) }).safeParse(credentials);
      if (!parsed.success) return null;
      const user = await prisma.user.upsert({
        where: { email: parsed.data.email },
        update: { name: parsed.data.name },
        create: { email: parsed.data.email, name: parsed.data.name, authSubject: `local:${parsed.data.email}` }
      });
      return { id: user.id, email: user.email, name: user.name };
    }
  })],
  session: { strategy: "jwt" },
  callbacks: { jwt: async ({ token, user }) => { if (user) token.sub = user.id; return token; } }
});
