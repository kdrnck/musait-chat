/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { Send, Settings, Activity, Clock, Zap, Bot, User, Code2, RefreshCw, Cpu, BrainCircuit } from "lucide-react";

export default function ModelTestPanel({ debugMode }: { debugMode: boolean }) {
    const [model, setModel] = useState("google/gemini-flash-1.5");
    const [system, setSystem] = useState("Sen profesyonel bir yapay zeka asistanısın. Kısa ve öz yanıtlar ver.");
    const [phone, setPhone] = useState("+905550000000");

    const startTimeRef = useRef<number>(0);
    const [stats, setStats] = useState<{ totalMs: number; tokensPerSec: number } | null>(null);

    const chatHelpers = (useChat as any)({
        api: "/api/admin/model-test",
        body: { model, system, phone },
        onFinish: (message: any) => {
            const ms = Date.now() - startTimeRef.current;
            setStats((prev) => ({
                ...prev,
                totalMs: ms,
                tokensPerSec: 0
            }));
        }
    });

    const { messages, input, handleInputChange, handleSubmit, isLoading, data } = chatHelpers;

    useEffect(() => {
        if (data && data.length > 0) {
            const lastData = data[data.length - 1] as any;
            if (lastData && lastData.usage && stats?.totalMs) {
                const computedTokensPerSec = (lastData.usage.completionTokens / (stats.totalMs / 1000)).toFixed(1);
                setStats(p => p ? { ...p, tokensPerSec: parseFloat(computedTokensPerSec) } : p);
            }
        }
    }, [data, stats?.totalMs]);

    return (
        <div className="flex flex-col lg:flex-row h-[850px] bg-[var(--color-bg-base)] rounded-2xl overflow-hidden shadow-sm border border-[var(--color-border)] animate-fade-in">
            {/* ── Settings Sidebar ── */}
            <div className="w-full lg:w-[360px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-[var(--color-border)] bg-[var(--color-surface-pure)] flex flex-col z-10 transition-all duration-300">
                <div className="p-6 sm:p-8 border-b border-[var(--color-border)] flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-brand-dark)]">
                            <Settings size={18} />
                        </div>
                        <div>
                            <h2 className="text-[14px] font-bold tracking-tight text-[var(--color-text-primary)] leading-none">Simülasyon Ayarı</h2>
                            <p className="text-[11px] font-medium text-[var(--color-text-secondary)] mt-1">Prompt ve Model Parametreleri</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 sm:p-8 flex-1 overflow-y-auto space-y-7 sidebar-scroll">
                    <div className="space-y-2.5">
                        <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1 flex items-center gap-2">
                            <Cpu size={14} className="text-[var(--color-brand-dark)]" /> Aktif Zeka
                        </label>
                        <select
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="w-full bg-[var(--color-surface-base)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-[var(--color-brand-dark)] focus:border-[var(--color-brand-dark)] transition-all appearance-none text-[13px] shadow-sm cursor-pointer"
                        >
                            <optgroup label="Google DeepMind" className="bg-[var(--color-surface-pure)] text-[var(--color-text-primary)]">
                                <option value="google/gemini-flash-1.5">Gemini Flash 1.5</option>
                            </optgroup>
                            <optgroup label="DeepSeek" className="bg-[var(--color-surface-pure)] text-[var(--color-text-primary)]">
                                <option value="deepinfra/deepseek/deepseek-r1">DeepSeek R1 (DeepInfra)</option>
                                <option value="groq/deepseek-r1-distill-llama-70b">DeepSeek R1 (Groq)</option>
                            </optgroup>
                            <optgroup label="Meta (Llama)" className="bg-[var(--color-surface-pure)] text-[var(--color-text-primary)]">
                                <option value="deepinfra/meta-llama/llama-3.3-70b-instruct">Llama 3.3 (DeepInfra)</option>
                                <option value="groq/meta-llama/llama-3.3-70b-versatile">Llama 3.3 (Groq)</option>
                            </optgroup>
                            <optgroup label="Open OSS" className="bg-[var(--color-surface-pure)] text-[var(--color-text-primary)]">
                                <option value="open-inference/int8">gpt-oss-120b (DeepInfra)</option>
                            </optgroup>
                        </select>
                    </div>

                    <div className="space-y-2.5">
                        <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1 flex items-center gap-2">
                            <User size={14} className="text-[var(--color-brand-dark)]" /> Kimlik Simülasyonu
                        </label>
                        <input
                            type="text"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full bg-[var(--color-surface-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[13px] font-medium text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-dark)] focus:ring-1 focus:ring-[var(--color-brand-dark)] transition-all placeholder-[var(--color-text-muted)] shadow-sm"
                            placeholder="+905..."
                        />
                    </div>

                    <div className="space-y-2.5 flex-1 flex flex-col min-h-[300px]">
                        <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1 flex items-center gap-2">
                            <Code2 size={14} className="text-[var(--color-brand-dark)]" /> Sistem Komutu
                        </label>
                        <textarea
                            value={system}
                            onChange={(e) => setSystem(e.target.value)}
                            className="w-full flex-1 bg-[var(--color-surface-base)] border border-[var(--color-border)] rounded-2xl p-4 text-[13px] font-medium leading-[1.6] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-dark)] focus:ring-1 focus:ring-[var(--color-brand-dark)] transition-all resize-none shadow-sm placeholder-[var(--color-text-muted)]"
                            placeholder="Sen yetkin bir asistansın..."
                        />
                    </div>
                </div>

                {/* Metrics Section */}
                <div className="p-6 border-t border-[var(--color-border)] bg-[var(--color-surface-hover)]">
                    <div className="flex items-center gap-2 mb-3 px-1">
                        <Activity size={14} className="text-[var(--color-status-success)]" />
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Donanım Analizi</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3.5">
                        <div className="bg-[var(--color-surface-pure)] border border-[var(--color-border)] rounded-xl p-3.5 shadow-sm">
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase mb-1">
                                <Clock size={12} /> Latency
                            </div>
                            <div className="text-[15px] font-semibold text-[var(--color-text-primary)] font-mono">
                                {stats?.totalMs ? `${(stats.totalMs / 1000).toFixed(2)}s` : "0.00s"}
                            </div>
                        </div>
                        <div className="bg-[var(--color-surface-pure)] border border-[var(--color-border)] rounded-xl p-3.5 shadow-sm">
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase mb-1">
                                <Zap size={12} /> Speed
                            </div>
                            <div className="text-[15px] font-semibold text-[var(--color-text-primary)] font-mono">
                                {stats?.tokensPerSec ? `${stats.tokensPerSec}` : "0"}<span className="text-[10px] ml-0.5 font-medium text-[var(--color-text-muted)] uppercase">T/s</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Chat Window ── */}
            <div className="flex-1 flex flex-col bg-[var(--color-surface-pure)] relative">
                <div className="h-[76px] flex-shrink-0 flex items-center justify-between px-6 sm:px-8 border-b border-[var(--color-border)] bg-[var(--color-surface-pure)] z-10">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-full bg-[var(--color-brand-light)] border border-[var(--color-brand-glow)] flex items-center justify-center text-[var(--color-brand-dark)]">
                            <BrainCircuit size={20} />
                        </div>
                        <div>
                            <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)] tracking-tight leading-none">Sandbox Simulator</h3>
                            <p className="text-[11px] font-semibold text-[var(--color-status-success)] flex items-center gap-1.5 mt-1.5 uppercase tracking-wider">
                                <span className="w-1.5 h-1.5 bg-[var(--color-status-success)] rounded-full animate-pulse shadow-sm" />
                                Yayına Hazır
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-8 space-y-5 content-scroll bg-[var(--color-bg-base)]">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center gap-5 animate-fade-in opacity-80">
                            <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)]">
                                <Bot size={28} />
                            </div>
                            <div className="max-w-[280px]">
                                <p className="text-[14px] font-semibold text-[var(--color-text-primary)] mb-1">Giriş Bekleniyor</p>
                                <p className="text-[13px] text-[var(--color-text-secondary)]">Test simülasyonunu başlatmak için bir mesaj gönderin.</p>
                            </div>
                        </div>
                    ) : (
                        messages.map((m: any) => (
                            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                                <div
                                    className={`px-5 py-3.5 max-w-[85%] sm:max-w-[75%] rounded-2xl text-[14px] leading-relaxed break-words border ${m.role === 'user'
                                            ? 'bg-[var(--color-customer-bg)] border-[var(--color-customer-border)] text-[var(--color-text-primary)] rounded-tr-sm shadow-sm'
                                            : 'bg-[var(--color-agent-bg)] border-[var(--color-agent-border)] text-[var(--color-text-primary)] rounded-tl-sm shadow-sm'
                                        }`}
                                >
                                    {m.content}
                                </div>
                            </div>
                        ))
                    )}
                    {isLoading && (
                        <div className="flex justify-start animate-fade-in px-1">
                            <div className="px-5 py-3.5 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-secondary)] text-[13px] font-medium rounded-tl-sm flex flex-col gap-2">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce [animation-delay:-0.3s]" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce [animation-delay:-0.15s]" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input form */}
                <div className="p-5 sm:p-6 border-t border-[var(--color-border)] bg-[var(--color-surface-pure)] z-10 w-full">
                    <form
                        onSubmit={(e) => {
                            startTimeRef.current = Date.now();
                            handleSubmit(e);
                        }}
                        className="flex gap-3 max-w-4xl mx-auto items-end"
                    >
                        <div className="flex-1 relative group">
                            <textarea
                                value={input}
                                onChange={handleInputChange}
                                placeholder="Test mesajınızı buraya yazın..."
                                className="w-full max-h-[140px] min-h-[48px] bg-[var(--color-surface-base)] border border-[var(--color-border)] focus:border-[var(--color-brand-dark)] text-[14px] text-[var(--color-text-primary)] rounded-2xl py-3 pl-4 pr-12 focus:ring-1 focus:ring-[var(--color-brand-dark)] outline-none resize-none transition-all shadow-sm"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        startTimeRef.current = Date.now();
                                        e.currentTarget.form?.requestSubmit();
                                    }
                                }}
                            />
                            <div className="absolute right-3.5 bottom-3.5 pointer-events-none">
                                <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${input.trim() ? 'bg-[var(--color-brand-dark)] shadow-[0_0_8px_var(--color-brand-glow)]' : 'bg-[var(--color-border-hover)]'}`} />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="h-[48px] w-[48px] bg-[var(--color-brand-dark)] hover:bg-[var(--color-brand-pressed)] text-white rounded-2xl flex items-center justify-center transition-all disabled:opacity-50 shadow-sm flex-shrink-0"
                        >
                            <Send size={18} className="translate-x-0.5 -translate-y-0.5" />
                        </button>
                    </form>
                    <p className="text-center text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mt-4 pb-1">
                        Yapay zeka modellerini güvenli sandbox ortamında test ediyorsunuz
                    </p>
                </div>
            </div>
        </div>
    );
}
