import "dotenv/config";
import cron from "node-cron";
import { generateDueRecurrences } from "../services/recurrence-service";
import { closeDueInvoices, markOverdueInvoices } from "../services/invoice-service";

async function runOnce(): Promise<void> {
  const generated = await generateDueRecurrences();
  const closed = await closeDueInvoices();
  const overdue = await markOverdueInvoices();
  console.log(
    `[jobs] ${new Date().toISOString()} recorrências geradas=${generated} faturas fechadas=${closed} faturas vencidas=${overdue}`,
  );
}

runOnce().catch((error) => console.error("[jobs] erro na execução inicial", error));

cron.schedule("0 6 * * *", () => {
  runOnce().catch((error) => console.error("[jobs] erro na execução agendada", error));
});

console.log("[jobs] agendador ativo, execução diária às 06:00");
