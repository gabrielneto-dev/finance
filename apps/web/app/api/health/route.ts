import { database } from "@/lib/db.mjs";

export const dynamic = "force-dynamic";

export function GET() {
  database().prepare("SELECT 1").get();
  return Response.json({ status: "ok" });
}
