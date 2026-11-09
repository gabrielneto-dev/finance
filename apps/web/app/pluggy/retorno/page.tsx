import { redirect } from "next/navigation";

export default function ReturnFromPluggy() {
  redirect("/?view=connections");
}
