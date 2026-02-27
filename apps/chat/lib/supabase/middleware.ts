import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    // Skip if Supabase keys are missing
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) {
        return supabaseResponse
    }

    const supabase = createServerClient(
        supabaseUrl,
        supabaseKey,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        request.cookies.set(name, value)

                        const updatedOptions = {
                            ...options,
                            domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined,
                            path: '/',
                            sameSite: 'lax' as const,
                            secure: process.env.NODE_ENV === 'production',
                        }

                        supabaseResponse.cookies.set(name, value, updatedOptions)
                    })
                },
            },
        }
    )

    const isAuthPath = request.nextUrl.pathname.startsWith('/login') ||
        request.nextUrl.pathname.startsWith('/auth') ||
        request.nextUrl.pathname.startsWith('/admin/login')

    try {
        const {
            data: { user },
            error,
        } = await supabase.auth.getUser()

        // Handle invalid refresh token error - clear cookies and redirect to login
        // But skip if already on auth paths to prevent redirect loops
        if (!isAuthPath && error && (
            error.message?.includes('Refresh Token') ||
            error.message?.includes('refresh_token') ||
            (error as any).code === 'refresh_token_not_found'
        )) {
            console.warn('🔐 Invalid session detected, clearing cookies and redirecting to login')

            const url = request.nextUrl.clone()
            url.pathname = '/login'
            const redirectResponse = NextResponse.redirect(url)

            // Clear Supabase auth cookies
            const cookieOptions = {
                domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined,
                path: '/',
                sameSite: 'lax' as const,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 0,
            }

            for (const cookie of request.cookies.getAll()) {
                if (cookie.name.startsWith('sb-')) {
                    redirectResponse.cookies.set(cookie.name, '', cookieOptions)
                }
            }

            return redirectResponse
        }

        if (
            !user &&
            !isAuthPath
        ) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }

        return supabaseResponse
    } catch (err) {
        // Unexpected error — don't loop, just pass through on auth paths
        console.error('🔐 Unexpected auth error in middleware:', err)

        if (isAuthPath) {
            return supabaseResponse
        }

        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }
}
