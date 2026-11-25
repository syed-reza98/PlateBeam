import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PROTECTED_PREFIXES = ['/dashboard', '/pos', '/kds', '/admin'] as const;

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function extractTenantSlug(hostHeader: string | null): string | null {
  if (!hostHeader) return null;
  const hostname = hostHeader.split(':')[0]?.toLowerCase() ?? '';
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
  ) {
    return null;
  }
  const parts = hostname.split('.');
  if (parts.length >= 3 && parts[0] && parts[0] !== 'www') {
    return parts[0];
  }
  return null;
}

function hasSessionCookie(request: NextRequest): boolean {
  if (request.cookies.get('pb_session')?.value) {
    return true;
  }
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token'));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Convenient Route Aliases & Redirections
  if (pathname.startsWith('/qr/')) {
    const targetUrl = new URL(pathname.replace('/qr/', '/t/'), request.url);
    targetUrl.search = request.nextUrl.search;
    return NextResponse.redirect(targetUrl);
  }
  if (pathname === '/ops/pos' || pathname === '/pos') {
    return NextResponse.redirect(new URL('/pos/zaika-bistro', request.url));
  }
  if (pathname === '/ops/kds' || pathname === '/kds') {
    return NextResponse.redirect(new URL('/kds/zaika-bistro', request.url));
  }
  if (pathname === '/ops/dashboard') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  if (pathname === '/ops/admin') {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  const traceId = request.headers.get('x-trace-id') ?? crypto.randomUUID();
  const tenantSlug = extractTenantSlug(request.headers.get('host'));

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-trace-id', traceId);
  if (tenantSlug) {
    requestHeaders.set('x-tenant-slug', tenantSlug);
  }

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let isAuthenticated = hasSessionCookie(request);

  if (supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: Parameters<typeof response.cookies.set>[2];
          }>,
        ) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) {
      isAuthenticated = true;
    } else if (!request.cookies.get('pb_session')?.value) {
      isAuthenticated = false;
    }
  }

  if (isProtectedPath(pathname) && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    redirectResponse.headers.set('x-trace-id', traceId);
    return redirectResponse;
  }

  response.headers.set('x-trace-id', traceId);
  if (tenantSlug) {
    response.headers.set('x-tenant-slug', tenantSlug);
  }
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)',
  ],
};
