import { generateDueRecurrences } from "@/server/services/recurrence-service";

async function run() {
  const count = await generateDueRecurrences();
  console.log(`Generated ${count} recurring transaction(s).`);
}

void run();
