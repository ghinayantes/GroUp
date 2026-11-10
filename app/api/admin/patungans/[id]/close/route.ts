import { closeBatch } from "@/lib/batch-create";
import { badId, guardRole } from "@/lib/route-guard";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Context) {
  const { denied } = await guardRole("admin");
  if (denied) return denied;
  const { id } = await params;
  return badId(id) ?? closeBatch(id);
}
