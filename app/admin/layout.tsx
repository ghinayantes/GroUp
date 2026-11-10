import Shell from "@/components/dashboard/Shell";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Layout({ children }: { children: React.ReactNode }) {
  return <Shell user={await requireRole("admin")}>{children}</Shell>;
}
