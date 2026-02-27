/* eslint-disable */
"use client";

import { motion } from "framer-motion";
import { Send, MoreHorizontal, Phone, ChevronLeft, Search, Users, Settings, User } from "lucide-react";

const mockMessages = [
    {
        id: 1,
        role: "customer" as const,
        content: "Merhaba, yarın için randevu almak istiyorum",
        time: "14:22",
    },
    {
        id: 2,
        role: "agent" as const,
        content: "Merhaba! Size yardımcı olmaktan mutluluk duyarım. Hangi hizmet için randevu almak istersiniz?",
        time: "14:22",
    },
    {
        id: 3,
        role: "customer" as const,
        content: "Saç kesimi için",
        time: "14:23",
    },
    {
        id: 4,
        role: "agent" as const,
        content: "Saç kesimi için yarın saat 10:00, 14:30 ve 16:00 müsait. Hangisi size uygun?",
        time: "14:23",
    },
    {
        id: 5,
        role: "customer" as const,
        content: "14:30 olsun lütfen. Ayrıca biraz uzun sürebilir, saçlarım oldukça gür ve uzun. Extra bir ücret çıkarsa sorun değil, yeter ki istediğim gibi bir model olsun.",
        time: "14:24",
    },
];

const mockConversations = [
    { id: 1, name: "+90 532 111****", lastMessage: "14:30 olsun lütfen. Ayrıca biraz uzun sürebilir...", time: "14:24", unread: 0, active: true },
    { id: 2, name: "+90 541 222****", lastMessage: "Teşekkürler, görüşürüz", time: "13:45", unread: 2, active: false },
    { id: 3, name: "Ali Yılmaz", lastMessage: "Fiyat listesi gönderebilir misiniz?", time: "12:10", unread: 0, active: false },
    { id: 4, name: "Ayşe K.", lastMessage: "Tamam, bekliyorum", time: "Dün", unread: 0, active: false },
];

const mockCustomerProfile = {
    name: "Bilinmeyen Müşteri",
    phone: "+90 532 111****",
    tags: ["VIP", "Aktif Müşteri"],
    notes: "Müşteri saç kesiminde çok titiz, her zaman randevusuna sadık kalıyor. Genelde Cuma günlerini tercih ediyor. Yanında mutlaka kahve ikramı istiyor.",
    appointments: [
        { date: "12 Ocak 2026", service: "Saç Kesimi & Fön", status: "Tamamlandı" },
        { date: "15 Aralık 2025", service: "Saç Boyama", status: "Tamamlandı" },
        { date: "20 Ekim 2025", service: "Saç Kesimi", status: "İptal" }
    ]
};

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1 },
    },
};

const messageVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6 }
    },
};

function Sidebar() {
    return (
        <div className="w-[340px] h-full bg-[#0a160d] flex flex-col z-10 border-r border-white/5 relative">
            <div className="absolute inset-0 bg-[#7CF854]/5 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 0, #7CF854 0, transparent 40%)' }} />

            <div className="p-8 pb-4 relative z-10">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-2xl font-serif text-white tracking-widest uppercase">Mesajlar</h1>
                    <button className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white transition-colors" aria-label="Ayarlar">
                        <Settings size={18} />
                    </button>
                </div>
                <div className="relative mb-2">
                    <Search size={16} className="absolute left-0 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                        type="text"
                        placeholder="Arama yapın..."
                        className="w-full pl-8 pr-4 py-2 bg-transparent text-sm font-light text-white placeholder:text-white/30 outline-none border-b border-white/10 focus:border-[#7CF854]/50 transition-colors rounded-none"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4 relative z-10" style={{ scrollbarWidth: "none" }}>
                {mockConversations.map((conv) => (
                    <div
                        key={conv.id}
                        className={`relative flex items-center gap-4 py-5 px-4 cursor-pointer transition-all border-b border-white/5 ${conv.active
                            ? "bg-white/5"
                            : "hover:bg-white/[0.02]"
                            }`}
                    >
                        {conv.active && (
                            <motion.div
                                layoutId="active-nav-indicator"
                                className="absolute left-0 top-1/4 bottom-1/4 w-[2px] bg-[#7CF854]"
                            />
                        )}
                        <div className="relative shrink-0">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-serif text-lg border ${conv.active ? "border-[#7CF854]/30 text-[#7CF854] bg-[#7CF854]/5" : "border-white/10 text-white/50 bg-white/5"
                                }`}>
                                {conv.name.charAt(0) !== '+' ? conv.name.charAt(0) : <Users size={18} />}
                            </div>
                            {conv.unread > 0 && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#7CF854] rounded-full flex items-center justify-center text-[10px] font-bold text-[#0a160d] shadow-sm">
                                    {conv.unread}
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0 py-1">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className={`text-[13px] font-medium tracking-wide truncate ${conv.active ? "text-white" : "text-white/70"}`}>
                                    {conv.name}
                                </span>
                                <span className={`text-[10px] uppercase tracking-widest ${conv.active ? 'text-[#7CF854]' : 'text-white/30'}`}>
                                    {conv.time}
                                </span>
                            </div>
                            <p className={`text-[12px] font-light leading-relaxed line-clamp-2 ${conv.active ? "text-white/60" : "text-white/40"}`}>
                                {conv.lastMessage}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ChatPanel({ showBackButton = true }: { showBackButton?: boolean }) {
    return (
        <div className="flex-1 flex flex-col bg-[#050b06] relative text-white">
            <header className="flex items-center justify-between px-8 py-6 z-10 border-b border-white/5">
                <div className="flex items-center gap-5">
                    {showBackButton && (
                        <button className="w-10 h-10 rounded-full flex items-center justify-center text-white/50 hover:text-white lg:hidden">
                            <ChevronLeft size={20} strokeWidth={1} />
                        </button>
                    )}
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center border border-white/10 bg-white/5">
                                <span className="text-[#7CF854] text-xl font-serif">M</span>
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#7CF854] rounded-full border-2 border-[#050b06]" />
                        </div>
                        <div>
                            <h2 className="text-base font-medium tracking-wide">
                                {mockCustomerProfile.phone}
                            </h2>
                            <p className="text-[10px] font-light text-[#7CF854] tracking-[0.2em] uppercase mt-1">
                                AI Aktif
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <button className="text-white/50 hover:text-white transition-all font-light tracking-widest text-xs uppercase flex items-center gap-2">
                        <Phone size={14} />
                        <span>Ara</span>
                    </button>
                    <button className="text-white/50 hover:text-white transition-all">
                        <MoreHorizontal size={20} strokeWidth={1} />
                    </button>
                </div>
            </header>

            <motion.div
                className="flex-1 overflow-y-auto px-8 py-8 space-y-8 z-10"
                style={{ scrollbarWidth: "none" }}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {mockMessages.map((msg) => (
                    <motion.div
                        key={msg.id}
                        variants={messageVariants}
                        className={`flex ${msg.role === "customer" ? "justify-start" : "justify-end"}`}
                    >
                        <div className="flex flex-col gap-2 max-w-[85%] md:max-w-[70%] lg:max-w-[55%]">
                            <div className={`p-6 rounded-none border ${msg.role === "customer"
                                ? "border-white/10 bg-white/[0.02]"
                                : "border-[#7CF854]/20 bg-[#7CF854]/5"
                                }`}
                            >
                                <div className={`font-light text-[14px] leading-loose whitespace-pre-wrap break-words ${msg.role === "customer" ? "text-white/80" : "text-[#7CF854]/90"
                                    }`}>
                                    {msg.content}
                                </div>
                            </div>
                            <div className={`text-[10px] uppercase tracking-widest font-light ${msg.role === "customer" ? "text-white/30 text-left" : "text-[#7CF854]/50 text-right"
                                }`}>
                                {msg.time}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </motion.div>

            <div className="px-8 py-6 pb-8 z-10">
                <div className="flex items-center gap-4 w-full border-t border-white/5 pt-6">
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            placeholder="MESAJINIZ..."
                            className="w-full px-2 py-4 bg-transparent text-[12px] font-light tracking-widest text-white placeholder:text-white/20 outline-none transition-all rounded-none uppercase"
                            disabled
                        />
                    </div>
                    <button className="w-12 h-12 flex items-center justify-center text-[#7CF854] hover:text-white transition-colors border border-[#7CF854]/30 rounded-full">
                        <Send size={16} className="translate-x-0.5" strokeWidth={1} />
                    </button>
                </div>
            </div>
        </div>
    );
}

function DetailsPanel() {
    return (
        <div className="hidden xl:flex w-[360px] h-full bg-[#0a160d] flex-col z-10 border-l border-white/5 text-white">
            <div className="p-10 pb-6 border-b border-white/5">
                <div className="w-20 h-20 rounded-full flex items-center justify-center border border-[#7CF854]/30 bg-[#7CF854]/5 mb-6">
                    <User size={28} className="text-[#7CF854]" strokeWidth={1} />
                </div>
                <h2 className="text-xl font-serif tracking-widest uppercase mb-2">{mockCustomerProfile.name}</h2>
                <p className="text-[11px] font-light tracking-[0.2em] text-[#7CF854] uppercase mb-6">{mockCustomerProfile.phone}</p>

                <div className="flex flex-wrap gap-3">
                    {mockCustomerProfile.tags.map(tag => (
                        <span key={tag} className="px-3 py-1 text-[9px] uppercase tracking-[0.2em] text-black bg-[#7CF854]">
                            {tag}
                        </span>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-10 py-8 space-y-10" style={{ scrollbarWidth: "none" }}>
                {/* Special Notes */}
                <div>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-[1px] flex-1 bg-white/10" />
                        <h3 className="text-[9px] uppercase tracking-[0.2em] text-white/40">ÖZEL NOTLAR</h3>
                        <div className="h-[1px] flex-1 bg-white/10" />
                    </div>
                    <div className="text-[13px] font-light leading-loose text-white/70 italic relative">
                        <span className="text-4xl text-[#7CF854] absolute -top-4 -left-4 opacity-20 font-serif">"</span>
                        {mockCustomerProfile.notes}
                        <span className="text-4xl text-[#7CF854] absolute -bottom-6 -right-2 opacity-20 font-serif">"</span>
                    </div>
                </div>

                {/* Appointments history */}
                <div>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-[1px] flex-1 bg-white/10" />
                        <h3 className="text-[9px] uppercase tracking-[0.2em] text-white/40">RANDEVULAR</h3>
                        <div className="h-[1px] flex-1 bg-white/10" />
                    </div>
                    <div className="space-y-6">
                        {mockCustomerProfile.appointments.map((apt, i) => (
                            <div key={i} className="group cursor-pointer">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[14px] font-medium tracking-wide group-hover:text-[#7CF854] transition-colors">{apt.service}</span>
                                    <span className="text-[10px] uppercase tracking-widest text-white/30">{apt.date}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 h-[1px] bg-white/5 mr-4" />
                                    <span className={`text-[8px] uppercase tracking-[0.2em] px-2 py-0.5 border ${apt.status === "Tamamlandı" ? "border-white/20 text-white/60" : "border-red-500/30 text-red-400"
                                        }`}>
                                        {apt.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Design6EmeraldEditorial() {
    return (
        <div className="w-full h-[85vh] max-h-[900px] flex">
            {/* Container frame - minimal and dark */}
            <div className="w-full h-full xl:max-w-[1400px] lg:max-w-[1000px] mx-auto bg-[#050b06] overflow-hidden flex flex-row font-sans shadow-2xl shadow-black ring-1 ring-white/10">
                <Sidebar />
                <ChatPanel showBackButton={false} />
                <DetailsPanel />
            </div>
        </div>
    );
}
