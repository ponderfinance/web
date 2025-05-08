
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Only add headers for GraphQL API requests
  if (request.nextUrl.pathname.includes('/api/graphql')) {
    console.log('Adding cache-control headers to GraphQL request');
    
    // Create a new response with the cache-busting headers
    const response = NextResponse.next();
    
    // Set cache-busting headers
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
    
    return response;
  }
  
  return NextResponse.next();
}

// Configure which paths this middleware will run on
export const config = {
  matcher: ['/api/graphql'],
};
