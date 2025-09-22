import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const { pathname } = request.nextUrl
  const isProtectedPath = pathname.startsWith('/dashboard')
  if (!isProtectedPath) return response

  // Temporarily bypass authentication for testing
  // TODO: Re-enable authentication when Supabase is properly configured
  
  // const { data } = await supabase.auth.getUser()
  // if (!data.user) {
  //   const loginUrl = new URL('/login', request.url)
  //   loginUrl.searchParams.set('redirectTo', pathname)
  //   return NextResponse.redirect(loginUrl)
  // }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*'],
}


