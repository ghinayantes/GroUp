import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { summarizeCategories, type CategorySummary } from "@/lib/batch";
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
  return <>
    <SiteHeader categories={categories} />
    <div className="site-main">{children}</div>
    <SiteFooter />
  </>;
}
