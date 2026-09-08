import { prisma } from "../lib/prisma";
import { addByFrequency } from "../lib/date";
import { createTransaction } from "./transaction-service";

const MAX_OCCURRENCES_PER_RUN = 60;

export async function generateDueRecurrences(now = new Date()): Promise<number> {
  const dueRecurrences = await prisma.recurrence.findMany({
    where: { active: true, nextRunDate: { lte: now } },
  });

  let generated = 0;

  for (const recurrence of dueRecurrences) {
    let nextRunDate = recurrence.nextRunDate;
    let active = recurrence.active;
    let iterations = 0;

    while (nextRunDate <= now && active && iterations < MAX_OCCURRENCES_PER_RUN) {
      await createTransaction({
        userId: recurrence.userId,
        date: nextRunDate,
        description: recurrence.description,
        amountCents: recurrence.amountCents,
        type: recurrence.type,
        origin: "RECURRING",
        accountId: recurrence.accountId,
        cardId: recurrence.cardId,
        categoryId: recurrence.categoryId,
        recurrenceId: recurrence.id,
      });
      generated++;
      iterations++;

      nextRunDate = addByFrequency(nextRunDate, recurrence.frequency, recurrence.interval);
      if (recurrence.endDate && nextRunDate > recurrence.endDate) {
        active = false;
      }
    }

    await prisma.recurrence.update({
      where: { id: recurrence.id },
      data: { nextRunDate, active },
    });
  }

  return generated;
}
