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
        <div className="flex flex-col lg:flex-row h-[850px] glass rounded-[40px] overflow-hidden shadow-2xl border border-white/5 animate-fade-in">
            {/* ── Settings Sidebar ── */}
            <div className="w-full lg:w-[360px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-white/5 bg-white/[0.02] flex flex-col">
                <div className="p-8 border-b border-white/5 bg-white/[0.02] flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-black/[0.1] flex items-center justify-center text-white">
                            <Settings size={20} />
                        </div>
                        <div>
                            <h2 className="text-[14px] font-black uppercase tracking-widest text-white leading-none">Simülasyon Ayarı</h2>
                            <p className="text-[10px] font-medium text-[#666] mt-1">Prompt ve Model Parametreleri</p>
                        </div>
                    </div>
                </div>

                <div className="p-8 flex-1 overflow-y-auto space-y-8 sidebar-scroll">
                    <div className="space-y-3">
                        <label className="text-[11px] font-bold text-[#666] uppercase tracking-widest ml-1 flex items-center gap-2">
                            <Cpu size={14} className="text-[var(--color-brand)]" /> Aktif Zeka
                        </label>
                        <select
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-[13px] font-medium text-white outline-none focus:border-[var(--color-brand-glow-strong)] transition-all cursor-pointer"
                        >
                            <optgroup label="Google DeepMind" className="bg-[#1a1a1a]">
                                <option value="google/gemini-flash-1.5">Gemini Flash 1.5</option>
                            </optgroup>
                            <optgroup label="DeepSeek" className="bg-[#1a1a1a]">
                                <option value="deepinfra/deepseek/deepseek-r1">DeepSeek R1 (DeepInfra)</option>
                                <option value="groq/deepseek-r1-distill-llama-70b">DeepSeek R1 (Groq)</option>
                            </optgroup>
                            <optgroup label="Meta (Llama)" className="bg-[#1a1a1a]">
                                <option value="deepinfra/meta-llama/llama-3.3-70b-instruct">Llama 3.3 (DeepInfra)</option>
                                <option value="groq/meta-llama/llama-3.3-70b-versatile">Llama 3.3 (Groq)</option>
                            </optgroup>
                        </select>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[11px] font-bold text-[#666] uppercase tracking-widest ml-1 flex items-center gap-2">
                            <User size={14} className="text-[var(--color-brand)]" /> Kimlik Simülasyonu
                        </label>
                        <input
                            type="text"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-[13px] font-medium text-white outline-none focus:border-[var(--color-brand-glow-strong)] transition-all placeholder:text-[#333]"
                            placeholder="+905..."
                        />
                    </div>

                    <div className="space-y-3 flex-1 flex flex-col min-h-[300px]">
                        <label className="text-[11px] font-bold text-[#666] uppercase tracking-widest ml-1 flex items-center gap-2">
                            <Code2 size={14} className="text-[var(--color-brand)]" /> Sistem Komutu
                        </label>
                        <textarea
                            value={system}
                            onChange={(e) => setSystem(e.target.value)}
                            className="w-full flex-1 bg-white/5 border border-white/10 rounded-3xl p-5 text-[12px] font-medium leading-relaxed text-[#AAAAAA] outline-none focus:border-[var(--color-brand-glow-strong)] transition-all resize-none"
                            placeholder="Sen yetkin bir asistansın..."
                        />
                    </div>
                </div>

                {/* Metrics Section */}
                <div className="p-8 border-t border-white/5 bg-white/[0.01]">
                    <div className="flex items-center gap-2 mb-4 px-1">
                        <Activity size={14} className="text-[var(--color-status-attention)]" />
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-[#666]">Donanım Analizi</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-[#444] uppercase mb-1">
                                <Clock size={12} /> Latency
                            </div>
                            <div className="text-xl font-black text-white font-mono">
                                {stats?.totalMs ? `${(stats.totalMs / 1000).toFixed(2)}s` : "0.00s"}
                            </div>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-[#444] uppercase mb-1">
                                <Zap size={12} /> Speed
                            </div>
                            <div className="text-xl font-black text-white font-mono">
                                {stats?.tokensPerSec ? `${stats.tokensPerSec}` : "0"}<span className="text-[10px] ml-1 text-[#444]">T/S</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Chat Window ── */}
            <div className="flex-1 flex flex-col bg-[#F9F9F9]">
                <div className="h-24 flex-shrink-0 flex items-center justify-between px-10 border-b border-black/[0.03] bg-white">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--color-brand-glow)] border border-[var(--color-brand-glow-strong)] flex items-center justify-center text-[var(--color-brand)]">
                            <BrainCircuit size={24} />
                        </div>
                        <div>
                            <h3 className="text-[16px] font-bold text-[var(--color-text-primary)] tracking-tight leading-none">Sandbox Simulator</h3>
                            <p className="text-[10px] font-black text-[var(--color-brand-dim)] flex items-center gap-2 mt-2 uppercase tracking-widest">
                                <span className="w-2 h-2 bg-[var(--color-brand)] rounded-full animate-pulse shadow-glow" /> 
                                Yayına Hazır
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-10 py-10 space-y-6 content-scroll">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center gap-6 animate-fade-in opacity-40 grayscale-[0.8]">
                            <div className="w-20 h-20 rounded-[32px] bg-white border border-black/5 shadow-sm flex items-center justify-center">
                                <Bot size={40} className="text-[var(--color-text-muted)]" />
                            </div>
                            <div className="max-w-[280px]">
                                <p className="text-[14px] font-bold text-[var(--color-text-primary)] mb-1">Giriş Bekleniyor</p>
                                <p className="text-[12px] font-medium text-[var(--color-text-muted)]">Test simülasyonunu başlatmak için bir mesaj gönderin.</p>
                            </div>
                        </div>
                    ) : (
                        messages.map((m: any) => (
                            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                                <div
                                    className={`px-6 py-4 max-w-[80%] rounded-3xl text-[14px] font-medium leading-relaxed relative shadow-sm ${
                                        m.role === 'user' 
                                        ? 'bg-white text-[var(--color-text-primary)] border border-black/5 rounded-tr-md shadow-xl shadow-black/5' 
                                        : 'bg-[#111111] text-white rounded-tl-md'
                                    }`}
                                >
                                    {m.content}
                                    {m.role === 'assistant' && (
                                        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10 rounded-[inherit] pointer-events-none" />
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                    {isLoading && (
                        <div className="flex justify-start animate-fade-in">
                            <div className="px-6 py-4 rounded-3xl bg-[#111111] text-white text-[14px] font-bold rounded-tl-md flex items-center gap-3">
                                <RefreshCw size={16} className="animate-spin text-[var(--color-brand)]" />
                                <span>Asistan Düşünüyor...</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input form */}
                <div className="p-8 border-t border-black/[0.03] bg-white">
                    <form
                        onSubmit={(e) => {
                            startTimeRef.current = Date.now();
                            handleSubmit(e);
                        }}
                        className="max-w-4xl mx-auto flex gap-4 relative items-end"
                    >
                        <div className="flex-1 relative group">
                            <textarea
                                value={input}
                                onChange={handleInputChange}
                                placeholder="Test mesajınızı buraya yazın..."
                                className="w-full max-h-[160px] min-h-[56px] bg-[var(--color-surface-base)] border border-black/[0.05] group-focus-within:border-[var(--color-brand-glow-strong)] group-focus-within:bg-white rounded-2xl py-4 px-6 outline-none text-[15px] font-medium text-[var(--color-text-primary)] resize-none transition-all pr-14"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        startTimeRef.current = Date.now();
                                        e.currentTarget.form?.requestSubmit();
                                    }
                                }}
                            />
                            <div className="absolute right-4 bottom-4">
                                <div className={`w-2 h-2 rounded-full ${input.trim() ? 'bg-[var(--color-brand)] shadow-[0_0_8px_var(--color-brand)]' : 'bg-black/5'}`} />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="bg-[#111111] hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 text-white h-[56px] w-[56px] rounded-2xl transition-all shadow-xl shadow-black/10 flex items-center justify-center flex-shrink-0"
                        >
                            <Send size={20} className="translate-x-0.5 -translate-y-0.5 text-[var(--color-brand)]" />
                        </button>
                    </form>
                    <p className="text-center text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mt-6">
                        Yapay zeka modellerini güvenli sandbox ortamında test ediyorsunuz
                    </p>
                </div>
            </div>
        </div>
    );
}
