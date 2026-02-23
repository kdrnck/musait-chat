'use client';

import { ReactNode } from 'react';
import { ConvexProvider, ConvexReactClient } from 'convex/react';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

// Guard: Convex URL must be set for the provider to work
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export default function Providers({ children }: { children: ReactNode }) {
    if (!convex) {
        // During build or if CONVEX_URL is missing, render children without Convex
        return <>{children}</>;
    }
    return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
