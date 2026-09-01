import { InvoiceStatus } from "@prisma/client";
import { invoiceReferenceFor } from "@/domain/scheduling";
import { prisma } from "@/lib/prisma";

export { invoiceReferenceFor };

type InvoiceClient = Pick<typeof prisma, "card" | "invoice">;

export async function findOrCreateInvoice(client: InvoiceClient, workspaceId: string, cardId: string, occurredAt: Date) {
  const card = await client.card.findFirstOrThrow({ where: { id: cardId, workspaceId } });
  const reference = invoiceReferenceFor(occurredAt, card.closingDay);
  const dueDate = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), card.dueDay));
  return client.invoice.upsert({
    where: { cardId_reference: { cardId, reference } },
    create: { workspaceId, cardId, reference, dueDate, status: InvoiceStatus.OPEN },
    update: {}
  });
}
