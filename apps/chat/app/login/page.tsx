import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Already authenticated → go to dashboard
    if (user) {
        redirect("/");
    }

    return (
        <main
            className="flex h-dvh items-center justify-center"
            style={{ background: "var(--color-surface-base)" }}
        >
            <div className="w-full max-w-sm px-6">
                {/* Logo */}
                <div className="flex flex-col items-center mb-8">
                    <div
                        className="w-14 h-14 flex items-center justify-center mb-4 glow"
                        style={{
                            background: "var(--color-brand)",
                            color: "var(--color-surface-base)",
                        }}
                    >
                        <span className="text-2xl font-bold">M</span>
                    </div>
                    <h1
                        className="text-2xl font-bold tracking-tight"
                        style={{ color: "var(--color-text-primary)" }}
                    >
                        Müsait Chat
                    </h1>
                    <p
                        className="text-xs mt-1 uppercase tracking-widest"
                        style={{ color: "var(--color-text-muted)" }}
                    >
                        İşletme Girişi
                    </p>
                </div>

                <LoginForm />

                {/* Footer hint */}
                <p
                    className="text-center text-[11px] mt-6 leading-relaxed"
                    style={{ color: "var(--color-text-muted)" }}
                >
                    musait.app/app üzerinden giriş yaptıysanız
                    <br />
                    oturum otomatik olarak paylaşılır.
                </p>
            </div>
        </main>
    );
}
