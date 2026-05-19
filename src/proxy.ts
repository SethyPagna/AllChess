import { NextResponse, type NextRequest } from "next/server";

function hasMalformedPathEncoding(url: string) {
  try {
    decodeURIComponent(new URL(url).pathname);
    return false;
  } catch {
    return true;
  }
}

export function proxy(request: NextRequest) {
  if (hasMalformedPathEncoding(request.url)) {
    return NextResponse.json({ error: "Unknown route." }, { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"]
};
