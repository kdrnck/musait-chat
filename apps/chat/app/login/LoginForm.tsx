"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogIn, Loader2, AlertCircle } from "lucide-react";

export default function LoginForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const supabase = createClient();
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) {
                if (authError.message.includes("Invalid login")) {
                    setError("E-posta veya şifre hatalı.");
                } else {
                    setError(authError.message);
                }
                return;
            }

            // Success — redirect to dashboard
            router.push("/");
            router.refresh();
        } catch {
            setError("Bir hata oluştu. Tekrar deneyin.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Error message */}
            {error && (
                <div
                    className="flex items-center gap-2 px-4 py-3 text-sm animate-fade-in"
                    style={{
                        background: "rgba(255, 77, 77, 0.08)",
                        border: "1px solid rgba(255, 77, 77, 0.3)",
                        color: "var(--color-status-attention)",
                    }}
                >
                    <AlertCircle size={14} />
                    {error}
                </div>
            )}

            {/* Email */}
            <div className="flex flex-col gap-1.5">
                <label
                    htmlFor="email"
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: "var(--color-text-muted)" }}
                >
                    E-posta
                </label>
                <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@isletme.com"
                    required
                    autoComplete="email"
                    className="px-4 py-3 text-sm outline-none transition-all placeholder:text-[var(--color-text-muted)]"
                    style={{
                        background: "var(--color-surface-2)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text-primary)",
                    }}
                    onFocus={(e) =>
                        (e.currentTarget.style.borderColor = "var(--color-border-brand)")
                    }
                    onBlur={(e) =>
                        (e.currentTarget.style.borderColor = "var(--color-border)")
                    }
                />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
                <label
                    htmlFor="password"
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: "var(--color-text-muted)" }}
                >
                    Şifre
                </label>
                <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="px-4 py-3 text-sm outline-none transition-all placeholder:text-[var(--color-text-muted)]"
                    style={{
                        background: "var(--color-surface-2)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text-primary)",
                    }}
                    onFocus={(e) =>
                        (e.currentTarget.style.borderColor = "var(--color-border-brand)")
                    }
                    onBlur={(e) =>
                        (e.currentTarget.style.borderColor = "var(--color-border)")
                    }
                />
            </div>

            {/* Submit button */}
            <button
                type="submit"
                disabled={loading || !email || !password}
                className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wider transition-all mt-2"
                style={{
                    background:
                        loading || !email || !password
                            ? "var(--color-surface-3)"
                            : "var(--color-brand)",
                    color:
                        loading || !email || !password
                            ? "var(--color-text-muted)"
                            : "var(--color-surface-base)",
                    border: "1px solid transparent",
                    cursor:
                        loading || !email || !password ? "not-allowed" : "pointer",
                }}
                onMouseEnter={(e) => {
                    if (!loading && email && password) {
                        e.currentTarget.style.background = "var(--color-brand-dim)";
                    }
                }}
                onMouseLeave={(e) => {
                    if (!loading && email && password) {
                        e.currentTarget.style.background = "var(--color-brand)";
                    }
                }}
            >
                {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                ) : (
                    <LogIn size={16} />
                )}
                {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>
        </form>
    );
}
