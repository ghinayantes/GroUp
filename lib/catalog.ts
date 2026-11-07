export type SortKey = "deadline" | "progres" | "harga";
export type CatalogFilters = { q: string; kategori: string; sort: SortKey; verified: boolean; hampir: boolean; segera: boolean };
export type SearchParams = Record<string, string | string[] | undefined>;

export const sortLabels: Record<SortKey, string> = { deadline: "Deadline terdekat", progres: "Progres kuota tertinggi", harga: "Harga per unit terendah" };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

/** Filter katalog dari query string; kategori dapat dikunci oleh halaman kategori. */
export function parseCatalogFilters(params: SearchParams, lockedCategory?: string): CatalogFilters {
  const sort = one(params.sort);
  return {
    q: one(params.q).slice(0, 100),
    kategori: lockedCategory ?? one(params.kategori),
    sort: sort === "progres" || sort === "harga" ? sort : "deadline",
    verified: one(params.verified) === "1",
    hampir: one(params.hampir) === "1",
    segera: one(params.segera) === "1",
  };
}
