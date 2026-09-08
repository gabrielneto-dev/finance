import "dotenv/config";
import Fastify from "fastify";
import { requireApiKey } from "./auth.js";
import { accountsRoutes } from "./routes/accounts.js";
import { cardsRoutes } from "./routes/cards.js";
import { categoriesRoutes } from "./routes/categories.js";
import { transactionsRoutes } from "./routes/transactions.js";
import { installmentsRoutes } from "./routes/installments.js";
import { recurrencesRoutes } from "./routes/recurrences.js";
import { invoicesRoutes } from "./routes/invoices.js";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ status: "ok" }));

app.addHook("onRequest", async (request, reply) => {
  if (request.url === "/health") return;
  await requireApiKey(request, reply);
});

app.register(accountsRoutes, { prefix: "/accounts" });
app.register(cardsRoutes, { prefix: "/cards" });
app.register(categoriesRoutes, { prefix: "/categories" });
app.register(transactionsRoutes, { prefix: "/transactions" });
app.register(installmentsRoutes, { prefix: "/installment-plans" });
app.register(recurrencesRoutes, { prefix: "/recurrences" });
app.register(invoicesRoutes, { prefix: "/invoices" });

const port = Number(process.env.API_PORT ?? 3000);

app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
