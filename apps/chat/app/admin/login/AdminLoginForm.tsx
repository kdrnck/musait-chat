"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Shield, Mail, Lock, Loader2, AlertTriangle } from "lucide-react";

export default function AdminLoginForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const supabase = createClient();

        const { data, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            setError("Giriş başarısız. E-posta veya şifreyi kontrol edin.");
            setLoading(false);
            return;
        }

        // Check for master role in app_metadata
        const role = data.user?.app_metadata?.role;
        if (role !== "master") {
            // Sign out immediately — this account has no admin access
            await supabase.auth.signOut();
            setError("Bu hesabın yönetici yetkisi bulunmuyor.");
            setLoading(false);
            return;
        }

        router.push("/admin");
        router.refresh();
    };

    return (
        <div
            className="min-h-screen w-full flex items-center justify-center p-6 relative overflow-hidden"
            style={{ background: "#0a0a0a" }}
        >
            {/* Background glow */}
            <div
                className="absolute top-[-15%] right-[-5%] w-[35%] h-[35%] rounded-full blur-[140px] opacity-15 pointer-events-none"
                style={{ background: "#7c3aed" }}
            />
            <div
                className="absolute bottom-[-10%] left-[-5%] w-[25%] h-[25%] rounded-full blur-[120px] opacity-10 pointer-events-none"
                style={{ background: "#7c3aed" }}
            />

            <div className="w-full max-w-[400px] z-10">
                {/* Header */}
                <div className="flex flex-col items-center mb-10">
                    <div
                        className="w-16 h-16 rounded-2xl mb-5 flex items-center justify-center shadow-2xl relative overflow-hidden"
                        style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)" }}
                    >
                        <Shield size={28} style={{ color: "#a78bfa" }} />
                    </div>
                    <h1 className="text-[26px] font-bold tracking-tight text-white mb-1">
                        Admin <span style={{ color: "#a78bfa" }}>Hub</span>
                    </h1>
                    <p className="text-[13px] font-medium" style={{ color: "#666" }}>
                        Müsait Core — Kısıtlı Erişim
                    </p>
                </div>

                {/* Card */}
                <div
                    className="rounded-[28px] p-8 shadow-2xl"
                    style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        backdropFilter: "blur(20px)",
                    }}
                >
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-[12px] font-semibold uppercase tracking-wider ml-1" style={{ color: "#888" }}>
                                E-posta
                            </label>
                            <div className="relative group">
                                <div
                                    className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors"
                                    style={{ color: "#555" }}
                                >
                                    <Mail size={17} />
                                </div>
                                <input
                                    type="email"
                                    placeholder="admin@musait.app"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full rounded-2xl py-3.5 pl-11 pr-4 text-[14px] font-medium text-white outline-none transition-all"
                                    style={{
                                        background: "rgba(255,255,255,0.05)",
                                        border: "1px solid rgba(255,255,255,0.08)",
                                    }}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[12px] font-semibold uppercase tracking-wider ml-1" style={{ color: "#888" }}>
                                Şifre
                            </label>
                            <div className="relative group">
                                <div
                                    className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors"
                                    style={{ color: "#555" }}
                                >
                                    <Lock size={17} />
                                </div>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full rounded-2xl py-3.5 pl-11 pr-4 text-[14px] font-medium text-white outline-none transition-all"
                                    style={{
                                        background: "rgba(255,255,255,0.05)",
                                        border: "1px solid rgba(255,255,255,0.08)",
                                    }}
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div
                                className="flex items-center gap-2.5 p-3.5 rounded-2xl text-[13px] font-medium"
                                style={{
                                    background: "rgba(239,68,68,0.08)",
                                    border: "1px solid rgba(239,68,68,0.2)",
                                    color: "#f87171",
                                }}
                            >
                                <AlertTriangle size={15} className="flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 rounded-2xl text-[14px] font-semibold text-white transition-all flex items-center justify-center gap-2 mt-2"
                            style={{
                                background: loading
                                    ? "rgba(124,58,237,0.4)"
                                    : "rgba(124,58,237,0.85)",
                                border: "1px solid rgba(124,58,237,0.5)",
                                cursor: loading ? "not-allowed" : "pointer",
                            }}
                        >
                            {loading ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <Shield size={16} />
                            )}
                            {loading ? "Doğrulanıyor..." : "Giriş Yap"}
                        </button>
                    </form>
                </div>

                <p className="text-center text-[11px] mt-6" style={{ color: "#444" }}>
                    Bu sayfa yalnızca yetkili yöneticiler içindir
                </p>
            </div>
        </div>
    );
}
