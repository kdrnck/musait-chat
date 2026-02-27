"use client";

import { motion } from "framer-motion";
import { Send, MoreHorizontal, Phone, ChevronLeft, Search, Users, Settings, User } from "lucide-react";

// Mock messages for demo
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
        { date: "12 Oca '26", service: "Saç Kesimi & Fön", status: "Tamamlandı" },
        { date: "15 Ara '25", service: "Saç Boyama", status: "Tamamlandı" },
        { date: "20 Eki '25", service: "Saç Kesimi", status: "İptal" }
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
    hidden: { opacity: 0, scale: 0.95, y: 10 },
    visible: {
        opacity: 1,
        scale: 1, y: 0,
        transition: { stiffness: 200, damping: 24 }
    },
};

// Common Neumorphic utility classes
const nmOuter = "bg-[#E0E5EC] shadow-[9px_9px_16px_rgb(163,177,198,0.6),-9px_-9px_16px_rgba(255,255,255,0.5)]";
const nmInner = "bg-[#E0E5EC] shadow-[inset_6px_6px_10px_0_rgba(163,177,198,0.7),inset_-6px_-6px_10px_0_rgba(255,255,255,0.8)]";
const nmButton = "bg-[#E0E5EC] shadow-[6px_6px_10px_0_rgba(163,177,198,0.7),-6px_-6px_10px_0_rgba(255,255,255,0.8)] active:shadow-[inset_4px_4px_6px_0_rgba(163,177,198,0.8),inset_-4px_-4px_6px_0_rgba(255,255,255,0.9)]";

function Sidebar() {
    return (
        <div className="w-[340px] h-full bg-[#E0E5EC] flex flex-col z-10 border-r border-white/40">
            <div className="p-6 pb-2">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-xl font-bold text-[#4D5B76] tracking-tight">Mesajlar</h1>
                    <button className={`w-10 h-10 rounded-full flex items-center justify-center text-[#4D5B76] transition-all ${nmButton}`} aria-label="Ayarlar">
                        <Settings size={18} />
                    </button>
                </div>
                <div className="relative mb-4">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9BA5B5]" />
                    <input
                        type="text"
                        placeholder="Arama yapın..."
                        className={`w-full pl-12 pr-4 py-3 rounded-2xl text-sm font-medium text-[#4D5B76] placeholder:text-[#9BA5B5] outline-none transition-all ${nmInner}`}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4" style={{ scrollbarWidth: "none" }}>
                {mockConversations.map((conv) => (
                    <div
                        key={conv.id}
                        className={`relative flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all ${conv.active
                            ? `${nmInner} border border-white/20`
                            : `${nmOuter} hover:opacity-80`
                            }`}
                    >
                        <div className="relative shrink-0">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${conv.active ? "text-[#7CF854] shadow-[inset_2px_2px_5px_rgba(0,0,0,0.1)]" : "text-[#9BA5B5]"
                                } ${!conv.active && nmOuter}`}>
                                {conv.name.charAt(0) !== '+' ? conv.name.charAt(0) : <Users size={20} />}
                            </div>
                            {conv.unread > 0 && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#7CF854] rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm border-2 border-[#E0E5EC]">
                                    {conv.unread}
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <span className={`text-sm font-bold truncate ${conv.active ? "text-[#4D5B76]" : "text-[#75849E]"}`}>
                                    {conv.name}
                                </span>
                                <span className={`text-[11px] font-medium ${conv.active ? 'text-[#7CF854]' : 'text-[#9BA5B5]'}`}>
                                    {conv.time}
                                </span>
                            </div>
                            <p className={`text-[13px] leading-tight line-clamp-2 ${conv.active ? "text-[#75849E]" : "text-[#9BA5B5]"}`}>
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
        <div className="flex-1 flex flex-col bg-[#E0E5EC] relative">
            <header className="flex items-center justify-between px-6 py-5 z-10">
                <div className="flex items-center gap-5">
                    {showBackButton && (
                        <button className={`w-10 h-10 rounded-full flex items-center justify-center text-[#4D5B76] lg:hidden ${nmButton}`}>
                            <ChevronLeft size={20} />
                        </button>
                    )}
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${nmOuter}`}>
                                <span className="text-[#4D5B76] text-xl font-bold">M</span>
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#7CF854] rounded-full border-2 border-[#E0E5EC]" />
                        </div>
                        <div>
                            <h2 className="text-[15px] font-bold text-[#4D5B76] tracking-tight">
                                {mockCustomerProfile.phone}
                            </h2>
                            <p className="text-[11px] font-medium text-[#7CF854] tracking-wide mt-0.5">
                                AI Aktif
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button className={`w-11 h-11 rounded-full flex items-center justify-center text-[#4D5B76] transition-all ${nmButton}`}>
                        <Phone size={18} />
                    </button>
                    <button className={`w-11 h-11 rounded-full flex items-center justify-center text-[#4D5B76] transition-all ${nmButton}`}>
                        <MoreHorizontal size={18} />
                    </button>
                </div>
            </header>

            <motion.div
                className="flex-1 overflow-y-auto px-6 py-4 space-y-6 z-10"
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
                            className={`max-w-[85%] md:max-w-[70%] lg:max-w-[60%] p-5 rounded-[1.5rem] ${msg.role === "customer"
                                ? `${nmOuter} rounded-tl-sm text-[#4D5B76]`
                                : `bg-gradient-to-br from-[#85fa5f] to-[#6de048] shadow-[6px_6px_12px_rgba(110,215,75,0.4),-6px_-6px_12px_rgba(255,255,255,0.8)] text-[#2C4A1C] rounded-tr-sm`
                                }`}
                        >
                            <div className="text-[14.5px] font-medium whitespace-pre-wrap break-words leading-relaxed">
                                {msg.content}
                            </div>
                            <div className={`mt-2 text-[10px] font-bold text-right opacity-60`}>
                                {msg.time}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </motion.div>

            <div className="px-6 py-6 pb-8 z-10">
                <div className="flex items-center gap-4 w-full">
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            placeholder="Mesaj yazın..."
                            className={`w-full px-6 py-4 rounded-full text-[14px] font-medium text-[#4D5B76] placeholder:text-[#9BA5B5] outline-none transition-all disabled:opacity-50 ${nmInner}`}
                            disabled
                        />
                    </div>
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        className={`w-14 h-14 rounded-full flex items-center justify-center text-[#2C4A1C] transition-all bg-gradient-to-br from-[#85fa5f] to-[#6de048] shadow-[6px_6px_12px_rgba(110,215,75,0.4),-6px_-6px_12px_rgba(255,255,255,0.8)]`}
                    >
                        <Send size={20} className="translate-x-0.5" />
                    </motion.button>
                </div>
            </div>
        </div>
    );
}

function DetailsPanel() {
    return (
        <div className="hidden xl:flex w-[320px] h-full bg-[#E0E5EC] flex-col z-10 border-l border-white/40">
            <div className="p-6 pb-2 text-center">
                <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-5 ${nmOuter}`}>
                    <User size={36} className="text-[#4D5B76]" />
                </div>
                <h2 className="text-lg font-bold text-[#4D5B76] tracking-tight">{mockCustomerProfile.name}</h2>
                <p className="text-sm font-medium text-[#9BA5B5] mt-1">{mockCustomerProfile.phone}</p>

                <div className="flex flex-wrap justify-center gap-2 mt-4">
                    {mockCustomerProfile.tags.map(tag => (
                        <span key={tag} className={`px-3 py-1.5 rounded-full text-[11px] font-bold text-[#7CF854] border border-white/20 ${nmInner}`}>
                            {tag}
                        </span>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8" style={{ scrollbarWidth: "none" }}>
                {/* Special Notes */}
                <div>
                    <h3 className="text-[11px] font-bold text-[#9BA5B5] uppercase tracking-wider mb-3 px-1">Özel Notlar</h3>
                    <div className={`p-5 rounded-2xl text-[13px] font-medium text-[#75849E] leading-relaxed ${nmInner}`}>
                        {mockCustomerProfile.notes}
                    </div>
                </div>

                {/* Appointments history */}
                <div>
                    <h3 className="text-[11px] font-bold text-[#9BA5B5] uppercase tracking-wider mb-3 px-1">Geçmiş Randevular</h3>
                    <div className="space-y-4">
                        {mockCustomerProfile.appointments.map((apt, i) => (
                            <div key={i} className={`p-4 rounded-xl flex items-center justify-between ${nmOuter}`}>
                                <div>
                                    <p className="text-[13px] font-bold text-[#4D5B76]">{apt.service}</p>
                                    <p className="text-[11px] font-medium text-[#9BA5B5] mt-1">{apt.date}</p>
                                </div>
                                <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${apt.status === "Tamamlandı" ? "text-emerald-500 bg-emerald-500/10" : "text-rose-500 bg-rose-500/10"
                                    }`}>
                                    {apt.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Design5Neumorphic() {
    return (
        <div className="w-full h-[85vh] max-h-[850px] flex">
            {/* Container frame */}
            <div className="w-full h-full xl:max-w-[1400px] lg:max-w-[1000px] mx-auto bg-[#E0E5EC] rounded-[2.5rem] overflow-hidden flex flex-row font-sans shadow-[20px_20px_60px_#bebebe,-20px_-20px_60px_#ffffff]">
                <Sidebar />
                <ChatPanel showBackButton={false} />
                <DetailsPanel />
            </div>
        </div>
    );
}
