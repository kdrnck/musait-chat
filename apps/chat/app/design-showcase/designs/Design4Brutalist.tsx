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
    name: "Bilinmeyen Müşteri (+90 532 111****)",
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
    hidden: { opacity: 0, x: -10, y: 10 },
    visible: {
        opacity: 1,
        x: 0, y: 0,
        transition: { duration: 0.2 }
    },
};

// Sidebar Component
function Sidebar({ className = "" }: { className?: string }) {
    return (
        <div className={`w-[320px] h-full bg-white border-r-4 border-black flex flex-col z-10 ${className}`}>
            <div className="p-4 border-b-4 border-black bg-[#7CF854]">
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-2xl font-black text-black tracking-tighter uppercase">Müşteriler</h1>
                    <button className="w-10 h-10 border-2 border-black flex items-center justify-center bg-white hover:bg-black hover:text-white transition-colors" aria-label="Ayarlar">
                        <Settings size={20} />
                    </button>
                </div>
                <div className="relative border-2 border-black bg-white">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-black" />
                    <input
                        type="text"
                        placeholder="ARA..."
                        className="w-full pl-10 pr-4 py-2 bg-transparent text-sm font-bold text-black placeholder:text-black/50 outline-none uppercase"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                {mockConversations.map((conv) => (
                    <div
                        key={conv.id}
                        className={`flex items-start gap-3 p-4 border-b-2 border-black cursor-pointer transition-colors ${conv.active ? "bg-black text-[#7CF854]" : "bg-white hover:bg-neutral-100 text-black"
                            }`}
                    >
                        <div className="relative shrink-0 mt-1">
                            <div className={`w-12 h-12 border-2 flex items-center justify-center font-bold ${conv.active ? "border-[#7CF854] text-[#7CF854]" : "border-black text-black"
                                }`}>
                                {conv.name.charAt(0) !== '+' ? conv.name.charAt(0) : <Users size={20} />}
                            </div>
                            {conv.unread > 0 && (
                                <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#7CF854] border-2 border-black flex items-center justify-center text-xs font-black text-black">
                                    {conv.unread}
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-black truncate uppercase">
                                    {conv.name}
                                </span>
                                <span className={`text-[10px] font-bold border ${conv.active ? 'border-[#7CF854] px-1' : 'border-black px-1 text-black'}`}>
                                    {conv.time}
                                </span>
                            </div>
                            <p className={`text-xs font-medium line-clamp-2 ${conv.active ? "text-white" : "text-black/70"}`}>
                                {conv.lastMessage}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Chat Component
function ChatPanel({ showBackButton = true }: { showBackButton?: boolean }) {
    return (
        <div className="flex-1 flex flex-col bg-white border-r-4 border-black relative">
            {/* Brutalist Pattern Background */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(black 2px, transparent 2px)', backgroundSize: '24px 24px' }} />

            <header className="flex items-center justify-between p-4 border-b-4 border-black bg-white z-10">
                <div className="flex items-center gap-4">
                    {showBackButton && (
                        <button className="w-10 h-10 border-2 border-black flex items-center justify-center hover:bg-[#7CF854] transition-colors lg:hidden">
                            <ChevronLeft size={20} />
                        </button>
                    )}
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-12 h-12 border-2 border-black bg-[#7CF854] flex items-center justify-center">
                                <span className="text-black text-xl font-black">M</span>
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#7CF854] border-2 border-black" />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-black tracking-tight uppercase">
                                +90 532 111****
                            </h2>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="w-2 h-2 bg-[#7CF854] border border-black animate-pulse" />
                                <p className="text-[10px] font-bold text-black uppercase tracking-widest">
                                    AI AKTİF
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button className="w-10 h-10 border-2 border-black flex items-center justify-center hover:bg-[#7CF854] transition-colors shadow-[2px_2px_0px_#000]">
                        <Phone size={18} />
                    </button>
                    <button className="w-10 h-10 border-2 border-black flex items-center justify-center hover:bg-[#7CF854] transition-colors shadow-[2px_2px_0px_#000]">
                        <MoreHorizontal size={18} />
                    </button>
                </div>
            </header>

            <motion.div
                className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 z-10"
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
                        <div
                            className={`max-w-[90%] md:max-w-[75%] lg:max-w-[65%] border-2 border-black ${msg.role === "customer"
                                ? "bg-white text-black shadow-[4px_4px_0px_#000]"
                                : "bg-[#7CF854] text-black shadow-[-4px_4px_0px_#000]"
                                }`}
                        >
                            <div className="p-3 md:p-4 text-sm md:text-base font-medium whitespace-pre-wrap break-words leading-relaxed">
                                {msg.content}
                            </div>
                            <div className={`px-3 py-1.5 md:px-4 text-[10px] font-bold border-t-2 border-black uppercase flex justify-between ${msg.role === "customer" ? "bg-neutral-100" : "bg-white"
                                }`}>
                                <span>{msg.role === "customer" ? "Müşteri" : "Müsait AI"}</span>
                                <span>{msg.time}</span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </motion.div>

            <div className="p-4 border-t-4 border-black bg-white z-10">
                <div className="flex items-center gap-3 w-full">
                    <div className="flex-1">
                        <input
                            type="text"
                            placeholder="MESAJINIZI YAZIN..."
                            className="w-full px-4 py-3 bg-neutral-100 border-2 border-black text-sm font-bold text-black placeholder:text-black/40 outline-none focus:bg-white focus:shadow-[4px_4px_0px_#000] transition-all uppercase disabled:opacity-50"
                            disabled
                        />
                    </div>
                    <button className="w-14 h-[46px] bg-black flex flex-col items-center justify-center text-[#7CF854] hover:bg-neutral-800 transition-colors shadow-[4px_4px_0px_#7CF854]">
                        <Send size={20} className="translate-x-0.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// Right Details Panel Component
function DetailsPanel() {
    return (
        <div className="hidden xl:flex w-[340px] h-full bg-white flex-col z-10">
            <div className="p-4 border-b-4 border-black bg-black text-white flex items-center gap-3">
                <User size={24} className="text-[#7CF854]" />
                <h2 className="text-xl font-black uppercase tracking-tight">Müşteri Profili</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-5" style={{ scrollbarWidth: "none" }}>
                {/* Profile Card */}
                <div className="border-4 border-black p-4 mb-6 shadow-[6px_6px_0px_#000]">
                    <div className="w-16 h-16 bg-[#7CF854] border-2 border-black flex items-center justify-center mb-4">
                        <span className="text-2xl font-black text-black">?</span>
                    </div>
                    <h3 className="text-lg font-black leading-tight uppercase mb-2">{mockCustomerProfile.name}</h3>
                    <div className="flex flex-wrap gap-2">
                        {mockCustomerProfile.tags.map(tag => (
                            <span key={tag} className="text-[10px] font-black uppercase border-2 border-black px-2 py-1 bg-yellow-300">
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Special Notes */}
                <div className="mb-6">
                    <div className="inline-block bg-black text-white text-xs font-black uppercase px-3 py-1 mb-2">
                        Özel Notlar
                    </div>
                    <div className="border-2 border-black p-4 bg-[#7CF854] text-sm font-bold shadow-[4px_4px_0px_#000]">
                        {mockCustomerProfile.notes}
                    </div>
                </div>

                {/* Appointments history */}
                <div>
                    <div className="inline-block bg-black text-white text-xs font-black uppercase px-3 py-1 mb-2">
                        Geçmiş Randevular
                    </div>
                    <div className="flex flex-col gap-3">
                        {mockCustomerProfile.appointments.map((apt, i) => (
                            <div key={i} className="border-2 border-black p-3 bg-white hover:bg-neutral-100 transition-colors">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-black bg-black text-white px-1.5 py-0.5">{apt.date}</span>
                                    <span className={`text-[10px] font-black uppercase px-1 border-2 ${apt.status === "Tamamlandı" ? "border-green-500 text-green-600" : "border-red-500 text-red-600"
                                        }`}>
                                        {apt.status}
                                    </span>
                                </div>
                                <p className="text-sm font-bold">{apt.service}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Design4Brutalist() {
    return (
        <div className="w-full h-[85vh] max-h-[850px] flex">
            {/* Container with brutal shadow */}
            <div className="w-full h-full xl:max-w-[1400px] lg:max-w-[1000px] mx-auto bg-white border-4 border-black overflow-hidden flex flex-row font-mono shadow-[12px_12px_0px_#7CF854] relative">
                <Sidebar className="hidden lg:flex" />
                <ChatPanel showBackButton={false} />
                <DetailsPanel />
            </div>
        </div>
    );
}
