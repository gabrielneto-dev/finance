import { installmentPlanCreateSchema } from "@/domain/finance";
import { prisma } from "@/lib/prisma";
import { currentUserId, apiError } from "@/server/api";
import { requireWorkspaceEditor, requireWorkspaceMember } from "@/server/auth";
import { createInstallmentPlan } from "@/server/services/installment-service";

export async function GET(_: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceMember(await currentUserId(), workspaceId);
    const plans = await prisma.installmentPlan.findMany({
      where: { workspaceId }, include: { card: true, transactions: { orderBy: { installmentNumber: "asc" } } }, orderBy: { createdAt: "desc" }
    });
    return Response.json(plans.map((plan) => ({
      ...plan,
      completedInstallments: plan.transactions.filter((item) => item.status === "COMPLETED").length,
      scheduledInstallments: plan.transactions.filter((item) => item.status === "SCHEDULED").length
    })));
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params;
    const userId = await currentUserId();
    await requireWorkspaceEditor(userId, workspaceId);
    const plan = await createInstallmentPlan(workspaceId, userId, installmentPlanCreateSchema.parse(await request.json()));
    return Response.json(plan, { status: 201 });
  } catch (error) { return apiError(error); }
}
