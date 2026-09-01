import { currentUserId, apiError } from "@/server/api";
import { requireWorkspaceEditor } from "@/server/auth";
import { cancelInstallmentPlan } from "@/server/services/installment-service";

export async function DELETE(_: Request, { params }: { params: Promise<{ workspaceId: string; planId: string }> }) {
  try {
    const { workspaceId, planId } = await params;
    await requireWorkspaceEditor(await currentUserId(), workspaceId);
    return Response.json(await cancelInstallmentPlan(workspaceId, planId));
  } catch (error) { return apiError(error); }
}
