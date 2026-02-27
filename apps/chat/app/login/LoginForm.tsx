"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";

export default function LoginForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // Clear any stale/invalid session on login page load
    useEffect(() => {
        const supabase = createClient();
        supabase.auth.signOut().catch(() => { /* Ignore errors - session may already be invalid */ });
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const supabase = createClient();
        const { error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            setError("Giriş başarısız. Lütfen bilgilerinizi kontrol edin.");
            setLoading(false);
        } else {
            router.push("/");
            router.refresh();
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-6 relative overflow-hidden"
             style={{ background: "#111111" }}>
            
            {/* Background Decorative Elements */}
            <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-20"
                 style={{ background: "var(--color-brand)" }} />
            <div className="absolute bottom-[-10%] left-[-5%] w-[30%] h-[30%] rounded-full blur-[100px] opacity-10"
                 style={{ background: "var(--color-brand)" }} />

            <div className="w-full max-w-[420px] z-10 animate-fade-in-up">
                {/* Logo Area */}
                <div className="flex flex-col items-center mb-10">
                    <div className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center glass shadow-2xl relative overflow-hidden group">
                        <img 
                            src="/musait-dark.png" 
                            alt="müsait" 
                            className="w-10 h-10 relative z-10 transition-transform duration-500 group-hover:scale-110" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
                        müsait <span style={{ color: "var(--color-brand)" }}>chat</span>
                    </h1>
                    <p className="text-[#888888] text-sm font-medium">Akıllı İşletme Yönetim Paneli</p>
                </div>

                {/* Login Card */}
                <div className="glass rounded-[32px] p-8 md:p-10 shadow-2xl border border-white/5">
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[13px] font-semibold text-[#AAAAAA] ml-1">E-posta</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666666] group-focus-within:text-[var(--color-brand)] transition-colors">
                                    <Mail size={18} />
                                </div>
                                <input
                                    type="email"
                                    placeholder="admin@musait.app"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-[var(--color-brand-glow-strong)] focus:bg-white/[0.08] transition-all text-[15px]"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[13px] font-semibold text-[#AAAAAA] ml-1">Şifre</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666666] group-focus-within:text-[var(--color-brand)] transition-colors">
                                    <Lock size={18} />
                                </div>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-[var(--color-brand-glow-strong)] focus:bg-white/[0.08] transition-all text-[15px]"
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] p-4 rounded-2xl animate-fade-in text-center font-medium">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 rounded-2xl font-bold text-[#111111] transition-all flex items-center justify-center gap-2 group relative overflow-hidden shadow-xl"
                            style={{ 
                                background: "var(--color-brand)",
                                boxShadow: "0 10px 30px rgba(124, 248, 84, 0.2)"
                            }}
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>
                                    <span>Giriş Yap</span>
                                    <LogIn size={18} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none opacity-0 group-hover:opacity-10" />
                        </button>
                    </form>
                </div>
                
                <p className="mt-8 text-center text-[#555555] text-[12px] font-medium tracking-wide uppercase">
                    &copy; 2024 Müsait Teknoloji A.Ş.
                </p>
            </div>
        </div>
    );
}
