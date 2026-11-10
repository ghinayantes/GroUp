import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { currentUser } from "@/lib/auth";
import { summarizeCategories, type CategorySummary } from "@/lib/batch";
import { ROLE_HOME } from "@/lib/roles";
import { listOpenBatches } from "@/lib/orders";

/** Kategori di header berasal dari batch terbuka, jadi selalu dirender per permintaan. */
export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  let categories: CategorySummary[] = [];
  try {
    categories = summarizeCategories(await listOpenBatches());
  } catch {
    categories = [];
  }
  const user = await currentUser();
  return <>
    <SiteHeader categories={categories} account={user ? { href: ROLE_HOME[user.role], label: "Dashboard" } : { href: "/masuk", label: "Masuk" }} />
    <div className="site-main">{children}</div>
    <SiteFooter />
  </>;
}
