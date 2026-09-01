import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import FinanceApp from "./workspace-client";

export default async function AppPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const workspaces = await prisma.workspace.findMany({ where: { members: { some: { userId: session.user.id } } }, orderBy: { createdAt: "asc" } });
  return <FinanceApp initialWorkspaces={workspaces.map((workspace) => ({ id: workspace.id, name: workspace.name }))} userName={session.user.name ?? "Voce"} signOutAction={async () => { "use server"; await signOut({ redirectTo: "/" }); }} />;
}
