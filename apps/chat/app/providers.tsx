'use client';

import { ReactNode } from 'react';
import { ConvexProvider, ConvexReactClient } from 'convex/react';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export default function Providers({ children }: { children: ReactNode }) {
    if (!convex) {
        // NEXT_PUBLIC_CONVEX_URL is not set — show a clear error instead of crashing
        // on useQuery calls with a confusing "ConvexProvider not found" message.
        return (
            <html lang="tr">
                <body style={{ fontFamily: 'monospace', padding: '2rem', background: '#111', color: '#f87171' }}>
                    <h2>⚠️ Yapılandırma Hatası</h2>
                    <p><code>NEXT_PUBLIC_CONVEX_URL</code> ortam değişkeni tanımlanmamış.</p>
                    <p style={{ color: '#9ca3af', marginTop: '1rem' }}>
                        <code>.env.local</code> dosyasına ekleyin:
                    </p>
                    <pre style={{ background: '#1f2937', padding: '1rem', borderRadius: '8px', color: '#86efac' }}>
                        NEXT_PUBLIC_CONVEX_URL=https://&lt;your-deployment&gt;.convex.cloud
                    </pre>
                </body>
            </html>
        );
    }
    return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
