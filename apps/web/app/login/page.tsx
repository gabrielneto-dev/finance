import { localLoginEnabled } from "@/lib/auth";
import { LoginForm } from "./form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm local={localLoginEnabled()} />;
}
