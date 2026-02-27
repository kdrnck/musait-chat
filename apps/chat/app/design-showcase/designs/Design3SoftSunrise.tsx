"use client";

import { motion } from "framer-motion";
import { Send, Heart, Smile, ChevronLeft, Calendar, Sun, Search, MessageCircle, Clock } from "lucide-react";

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
    transition: { staggerChildren: 0.12 },
  },
};

const messageVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] as const }
  },
};

// Sidebar Component (Desktop only)
function Sidebar() {
  return (
    <div 
      className="w-80 h-full flex flex-col relative"
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(255,247,237,0.9) 100%)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRight: "1px solid rgba(251, 146, 60, 0.1)",
      }}
    >
      {/* Sidebar Header */}
      <div className="p-5 border-b border-orange-100/50">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-orange-900 tracking-tight flex items-center gap-2">
            <Sun size={22} className="text-orange-400" />
            Müsait
          </h1>
          <button 
            className="w-9 h-9 rounded-xl hover:bg-orange-100/50 flex items-center justify-center transition-colors"
            aria-label="Takvim"
          >
            <Calendar size={18} className="text-orange-400" />
          </button>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-300" />
          <input
            type="text"
            placeholder="Ara…"
            className="w-full pl-11 pr-4 py-2.5 rounded-2xl text-sm outline-none transition-all text-orange-900 placeholder:text-orange-300"
            style={{
              background: "rgba(255, 255, 255, 0.8)",
              border: "1px solid rgba(251, 146, 60, 0.15)",
            }}
          />
        </div>
      </div>
      
      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: "none" }}>
        {mockConversations.map((conv) => (
          <div
            key={conv.id}
            className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-all ${
              conv.active 
                ? "bg-gradient-to-r from-orange-100 to-orange-50" 
                : "hover:bg-orange-50/50"
            }`}
          >
            <div className="relative">
              <div 
                className="w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{
                  background: conv.active 
                    ? "linear-gradient(135deg, #FB923C 0%, #F97316 100%)"
                    : "rgba(251, 146, 60, 0.1)",
                }}
              >
                <MessageCircle size={18} className={conv.active ? "text-white" : "text-orange-400"} />
              </div>
              {conv.unread > 0 && (
                <div 
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{
                    background: "linear-gradient(135deg, #FB923C 0%, #F97316 100%)",
                    boxShadow: "0 2px 8px rgba(249, 115, 22, 0.3)",
                  }}
                >
                  {conv.unread}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold truncate ${conv.active ? "text-orange-900" : "text-orange-800"}`}>
                  {conv.name}
                </span>
                <span className="text-[11px] text-orange-400 flex items-center gap-1">
                  <Clock size={10} />
                  {conv.time}
                </span>
              </div>
              <p className={`text-[13px] truncate ${conv.active ? "text-orange-600" : "text-orange-400"}`}>
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
    <div className="flex-1 flex flex-col relative">
      {/* Decorative Shapes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute -top-20 -right-20 w-48 h-48 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, #FDBA74 0%, transparent 70%)" }}
        />
        <div 
          className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full opacity-25"
          style={{ background: "radial-gradient(circle, #F9A8D4 0%, transparent 70%)" }}
        />
      </div>

      {/* Header */}
      <header 
        className="flex items-center justify-between px-5 py-4 relative z-10"
        style={{
          background: "rgba(255, 255, 255, 0.6)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(251, 146, 60, 0.1)",
        }}
      >
        <div className="flex items-center gap-3">
          {showBackButton && (
            <button 
              className="w-10 h-10 rounded-2xl flex items-center justify-center hover:bg-orange-100/50 transition-colors lg:hidden"
              aria-label="Geri"
            >
              <ChevronLeft size={22} className="text-orange-400" />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #FB923C 0%, #F97316 100%)",
                  boxShadow: "0 6px 24px rgba(249, 115, 22, 0.25)",
                }}
              >
                <Sun size={20} className="text-white" />
              </div>
              <div 
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #34D399 0%, #10B981 100%)",
                  boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
                }}
              >
                <Heart size={10} className="text-white" fill="white" />
              </div>
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-orange-900 tracking-tight">
                +90 532 ***
              </h2>
              <p className="text-[12px] text-orange-400 font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Sohbet aktif
              </p>
            </div>
          </div>
        </div>
        <button 
          className="w-10 h-10 rounded-2xl flex items-center justify-center hover:bg-orange-100/50 transition-colors"
          aria-label="Takvim"
        >
          <Calendar size={20} className="text-orange-400" />
        </button>
      </header>

      {/* Messages */}
      <motion.div
        className="flex-1 overflow-y-auto px-4 lg:px-8 py-5 space-y-3 relative z-10"
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
              className={`max-w-[80%] lg:max-w-[60%] relative ${
                msg.role === "customer"
                  ? "rounded-3xl rounded-tl-lg"
                  : "rounded-3xl rounded-tr-lg"
              }`}
              style={
                msg.role === "customer"
                  ? {
                      background: "rgba(255, 255, 255, 0.85)",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                      boxShadow: "0 4px 24px rgba(251, 146, 60, 0.08)",
                      border: "1px solid rgba(251, 146, 60, 0.08)",
                    }
                  : {
                      background: "linear-gradient(135deg, #FB923C 0%, #F97316 100%)",
                      boxShadow: "0 6px 24px rgba(249, 115, 22, 0.25)",
                    }
              }
            >
              <p 
                className={`px-5 py-3.5 text-[14.5px] leading-relaxed ${
                  msg.role === "customer" ? "text-orange-900" : "text-white"
                }`}
              >
                {msg.content}
              </p>
              <span 
                className={`block px-5 pb-3 text-[10px] font-semibold ${
                  msg.role === "customer" ? "text-orange-300" : "text-white/60"
                }`}
              >
                {msg.time}
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Input Area */}
      <div 
        className="px-4 lg:px-8 py-4 relative z-10"
        style={{
          background: "rgba(255, 255, 255, 0.7)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(251, 146, 60, 0.1)",
        }}
      >
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <button 
            className="w-11 h-11 rounded-2xl flex items-center justify-center hover:bg-orange-100/50 transition-colors"
            aria-label="Emoji"
          >
            <Smile size={22} className="text-orange-300" />
          </button>
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Bir mesaj yazın…"
              className="w-full px-5 py-3.5 rounded-2xl text-[14px] text-orange-900 placeholder:text-orange-300 outline-none transition-all"
              style={{
                background: "rgba(255, 255, 255, 0.9)",
                border: "2px solid rgba(251, 146, 60, 0.15)",
              }}
              disabled
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.08, rotate: -5 }}
            whileTap={{ scale: 0.92, rotate: 0 }}
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-all"
            style={{
              background: "linear-gradient(135deg, #FB923C 0%, #F97316 100%)",
              boxShadow: "0 6px 24px rgba(249, 115, 22, 0.35)",
            }}
            aria-label="Gönder"
          >
            <Send size={18} className="translate-x-0.5 -translate-y-0.5" />
          </motion.button>
        </div>
        
        {/* Fun Footer */}
        <div className="flex items-center justify-center gap-2 mt-3">
          <span className="text-[11px] text-orange-400/60 font-medium">
            💬 Müsait ile her zaman yanınızdayız
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Design3SoftSunrise() {
  return (
    <div className="w-full h-[85vh] max-h-[800px] flex">
      {/* Mobile View */}
      <div 
        className="lg:hidden w-full max-w-[420px] mx-auto rounded-[2.5rem] overflow-hidden flex flex-col relative shadow-2xl"
        style={{
          background: "linear-gradient(165deg, #FFF7ED 0%, #FEF3E2 30%, #FDECD7 60%, #FEE2E2 100%)",
        }}
      >
        <ChatPanel showBackButton={true} />
      </div>
      
      {/* Desktop View */}
      <div 
        className="hidden lg:flex w-full max-w-[1100px] mx-auto rounded-[2rem] overflow-hidden shadow-2xl"
        style={{
          background: "linear-gradient(165deg, #FFF7ED 0%, #FEF3E2 30%, #FDECD7 60%, #FEE2E2 100%)",
        }}
      >
        <Sidebar />
        <ChatPanel showBackButton={false} />
      </div>
    </div>
  );
}
