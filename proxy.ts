import { NextResponse, type NextRequest } from "next/server";
import { dashboardRedirect } from "@/lib/roles";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const target = dashboardRedirect(request.nextUrl.pathname, request.nextUrl.search, user);
  if (!target) return response;
  const redirect = NextResponse.redirect(new URL(target, request.url));
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
