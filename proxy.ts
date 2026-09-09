import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/health") {
    return NextResponse.next();
  }

  const expected = process.env.API_KEY;
  if (!expected) {
    return NextResponse.json({ error: "API_KEY não configurada no servidor." }, { status: 500 });
  }

  const provided = request.headers.get("x-api-key");
  if (provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
