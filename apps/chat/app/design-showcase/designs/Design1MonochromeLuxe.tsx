"use client";

import { motion } from "framer-motion";
import { Send, MoreHorizontal, Phone, ChevronLeft, Search, Users, MessageSquare, Settings } from "lucide-react";

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
    content: "14:30 olsun lütfen",
    time: "14:24",
  },
];

// Mock conversations for sidebar
const mockConversations = [
  { id: 1, name: "+90 532 ***", lastMessage: "14:30 olsun lütfen", time: "14:24", unread: 0, active: true },
  { id: 2, name: "+90 541 ***", lastMessage: "Teşekkürler, görüşürüz", time: "13:45", unread: 2, active: false },
  { id: 3, name: "+90 555 ***", lastMessage: "Fiyat ne kadar?", time: "12:10", unread: 0, active: false },
  { id: 4, name: "+90 538 ***", lastMessage: "Tamam, beklerim", time: "Dün", unread: 0, active: false },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const messageVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const }
  },
};

// Sidebar Component (Desktop only)
function Sidebar() {
  return (
    <div className="w-80 h-full bg-neutral-50 border-r border-neutral-200 flex flex-col">
      {/* Sidebar Header */}
      <div className="p-5 border-b border-neutral-100">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-semibold text-neutral-900 tracking-tight font-serif">Müsait</h1>
          <button 
            className="w-9 h-9 rounded-full hover:bg-neutral-200 flex items-center justify-center transition-colors"
            aria-label="Ayarlar"
          >
            <Settings size={18} className="text-neutral-500" />
          </button>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Sohbetlerde ara…"
            className="w-full pl-11 pr-4 py-2.5 bg-white rounded-full text-sm border border-neutral-200 focus:ring-2 focus:ring-neutral-900/10 outline-none transition-all"
          />
        </div>
      </div>
      
      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: "none" }}>
        {mockConversations.map((conv) => (
          <div
            key={conv.id}
            className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors ${
              conv.active ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"
            }`}
          >
            <div className="relative">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center ${
                conv.active ? "bg-white text-neutral-900" : "bg-neutral-200 text-neutral-600"
              }`}>
                <Users size={18} />
              </div>
              {conv.unread > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-neutral-900 rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                  {conv.unread}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium truncate ${conv.active ? "text-white" : "text-neutral-900"}`}>
                  {conv.name}
                </span>
                <span className={`text-[11px] ${conv.active ? "text-neutral-400" : "text-neutral-400"}`}>
                  {conv.time}
                </span>
              </div>
              <p className={`text-[13px] truncate ${conv.active ? "text-neutral-300" : "text-neutral-500"}`}>
                {conv.lastMessage}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Chat Panel Component
function ChatPanel({ showBackButton = true }: { showBackButton?: boolean }) {
  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
        <div className="flex items-center gap-4">
          {showBackButton && (
            <button 
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-neutral-100 transition-colors lg:hidden"
              aria-label="Geri"
            >
              <ChevronLeft size={20} strokeWidth={1.5} className="text-neutral-600" />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-full bg-neutral-900 flex items-center justify-center">
                <span className="text-white text-sm font-serif italic">M</span>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
            </div>
            <div>
              <h2 className="text-[15px] font-medium text-neutral-900 tracking-tight">
                +90 532 ***
              </h2>
              <p className="text-[11px] text-neutral-400 tracking-wide uppercase">
                AI Aktif
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-neutral-100 transition-colors"
            aria-label="Ara"
          >
            <Phone size={18} strokeWidth={1.5} className="text-neutral-500" />
          </button>
          <button 
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-neutral-100 transition-colors"
            aria-label="Daha fazla"
          >
            <MoreHorizontal size={18} strokeWidth={1.5} className="text-neutral-500" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <motion.div
        className="flex-1 overflow-y-auto px-5 py-6 space-y-4"
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
              className={`max-w-[85%] lg:max-w-[65%] ${
                msg.role === "customer"
                  ? "bg-neutral-100 text-neutral-900 rounded-[1.25rem] rounded-tl-[0.25rem]"
                  : "bg-neutral-900 text-white rounded-[1.25rem] rounded-tr-[0.25rem]"
              }`}
            >
              <p className="px-5 py-3.5 text-[14.5px] leading-relaxed tracking-[-0.01em]">
                {msg.content}
              </p>
              <span
                className={`block px-5 pb-2.5 text-[10px] tracking-wide ${
                  msg.role === "customer" ? "text-neutral-400" : "text-neutral-500"
                }`}
              >
                {msg.time}
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Input Area */}
      <div className="px-4 py-4 border-t border-neutral-100">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Mesaj yazın…"
              className="w-full px-5 py-3.5 bg-neutral-50 rounded-full text-[14px] text-neutral-900 placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-neutral-200 transition-all"
              disabled
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-12 h-12 bg-neutral-900 rounded-full flex items-center justify-center text-white shadow-lg shadow-neutral-900/20 hover:bg-neutral-800 transition-colors"
            aria-label="Gönder"
          >
            <Send size={18} strokeWidth={1.5} className="translate-x-0.5" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}

export default function Design1MonochromeLuxe() {
  return (
    <div className="w-full h-[85vh] max-h-[800px] flex">
      {/* Mobile View */}
      <div className="lg:hidden w-full max-w-[420px] mx-auto bg-white rounded-[2.5rem] shadow-2xl shadow-black/20 overflow-hidden flex flex-col font-sans border border-neutral-200">
        <ChatPanel showBackButton={true} />
      </div>
      
      {/* Desktop View */}
      <div className="hidden lg:flex w-full max-w-[1100px] mx-auto bg-white rounded-[2rem] shadow-2xl shadow-black/20 overflow-hidden font-sans border border-neutral-200">
        <Sidebar />
        <ChatPanel showBackButton={false} />
      </div>
    </div>
  );
}
