import { NextResponse, type NextRequest } from "next/server";

/**
 * Security middleware: HSTS in production and strict CORS on /api — only the
 * configured production origin may make cross-origin API calls. The Razorpay
 * webhook is exempt from CORS (server-to-server, signature-verified instead).
 */
export function middleware(req: NextRequest) {
  const isApi = req.nextUrl.pathname.startsWith("/api");
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const origin = req.headers.get("origin");

  if (isApi && req.method === "OPTIONS") {
    const headers = new Headers();
    if (origin && origin === allowedOrigin) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      headers.set("Access-Control-Allow-Credentials", "true");
    }
    return new NextResponse(null, { status: 204, headers });
  }

  const res = NextResponse.next();

  if (process.env.NODE_ENV === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  if (isApi && origin && origin === allowedOrigin) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Credentials", "true");
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
