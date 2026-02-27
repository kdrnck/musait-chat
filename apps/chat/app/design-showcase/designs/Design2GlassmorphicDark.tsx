"use client";

import { motion } from "framer-motion";
import { Send, Sparkles, Bot, User, Settings2, ChevronLeft, Search, MessageCircle, Zap } from "lucide-react";

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
  { id: 1, name: "+90 532 ***", lastMessage: "14:30 olsun lütfen", time: "14:24", unread: 0, active: true, isAI: true },
  { id: 2, name: "+90 541 ***", lastMessage: "Teşekkürler, görüşürüz", time: "13:45", unread: 2, active: false, isAI: true },
  { id: 3, name: "+90 555 ***", lastMessage: "Fiyat ne kadar?", time: "12:10", unread: 0, active: false, isAI: false },
  { id: 4, name: "+90 538 ***", lastMessage: "Tamam, beklerim", time: "Dün", unread: 0, active: false, isAI: true },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const messageVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }
  },
};

// Sidebar Component (Desktop only)
function Sidebar() {
  return (
    <div 
      className="w-80 h-full flex flex-col relative"
      style={{
        background: "rgba(0, 0, 0, 0.3)",
        borderRight: "1px solid rgba(255, 255, 255, 0.05)",
      }}
    >
      {/* Sidebar Header */}
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Zap size={20} className="text-violet-400" />
            Müsait
          </h1>
          <button 
            className="w-9 h-9 rounded-xl hover:bg-white/5 flex items-center justify-center transition-colors"
            aria-label="Ayarlar"
          >
            <Settings2 size={18} className="text-white/40" />
          </button>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Ara…"
            className="w-full pl-11 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all text-white placeholder:text-white/30"
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
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
                ? "bg-gradient-to-r from-violet-500/20 to-indigo-500/10 border-l-2 border-violet-400" 
                : "hover:bg-white/5 border-l-2 border-transparent"
            }`}
          >
            <div className="relative">
              <div 
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{
                  background: conv.active 
                    ? "linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)"
                    : "rgba(255, 255, 255, 0.05)",
                }}
              >
                <MessageCircle size={18} className={conv.active ? "text-white" : "text-white/40"} />
              </div>
              {conv.unread > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-violet-500/30">
                  {conv.unread}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium truncate ${conv.active ? "text-white" : "text-white/80"}`}>
                  {conv.name}
                </span>
                <span className="text-[11px] text-white/30">
                  {conv.time}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {conv.isAI && <Bot size={10} className="text-violet-400" />}
                <p className={`text-[13px] truncate ${conv.active ? "text-white/60" : "text-white/40"}`}>
                  {conv.lastMessage}
                </p>
              </div>
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
      {/* Ambient Glow Effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute -top-32 -right-32 w-64 h-64 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, #8B5CF6 0%, transparent 70%)" }}
        />
        <div 
          className="absolute -bottom-32 -left-32 w-64 h-64 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #6366F1 0%, transparent 70%)" }}
        />
      </div>

      {/* Header */}
      <header 
        className="flex items-center justify-between px-5 py-4 relative z-10"
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        <div className="flex items-center gap-3">
          {showBackButton && (
            <button 
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/5 transition-colors lg:hidden"
              aria-label="Geri"
            >
              <ChevronLeft size={20} className="text-white/60" />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div 
                className="w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)",
                  boxShadow: "0 4px 20px rgba(139, 92, 246, 0.3)",
                }}
              >
                <User size={18} className="text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-lg border-2 border-[#1a1625] flex items-center justify-center">
                <Sparkles size={8} className="text-emerald-900" />
              </div>
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-white tracking-tight">
                +90 532 ***
              </h2>
              <p className="text-[11px] text-violet-400 font-medium flex items-center gap-1">
                <Bot size={10} />
                AI Yanıtlıyor
              </p>
            </div>
          </div>
        </div>
        <button 
          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/5 transition-colors"
          aria-label="Ayarlar"
        >
          <Settings2 size={18} className="text-white/40" />
        </button>
      </header>

      {/* Messages */}
      <motion.div
        className="flex-1 overflow-y-auto px-4 lg:px-8 py-5 space-y-4 relative z-10"
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
              className="max-w-[82%] lg:max-w-[60%] relative"
              style={
                msg.role === "customer"
                  ? {
                      background: "rgba(255, 255, 255, 0.05)",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "1.25rem",
                      borderTopLeftRadius: "0.375rem",
                    }
                  : {
                      background: "linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(99, 102, 241, 0.15) 100%)",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                      border: "1px solid rgba(139, 92, 246, 0.2)",
                      borderRadius: "1.25rem",
                      borderTopRightRadius: "0.375rem",
                    }
              }
            >
              {msg.role === "agent" && (
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-lg bg-violet-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                  <Sparkles size={10} className="text-white" />
                </div>
              )}
              <p className="px-4 py-3 text-[14px] leading-relaxed text-white/90">
                {msg.content}
              </p>
              <span className="block px-4 pb-2.5 text-[10px] text-white/30 font-medium">
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
          background: "rgba(255, 255, 255, 0.02)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: "1px solid rgba(255, 255, 255, 0.04)",
        }}
      >
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Mesaj yazın…"
              className="w-full px-5 py-3.5 rounded-2xl text-[14px] text-white placeholder:text-white/30 outline-none transition-all"
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
              disabled
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-all"
            style={{
              background: "linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)",
              boxShadow: "0 4px 20px rgba(139, 92, 246, 0.4)",
            }}
            aria-label="Gönder"
          >
            <Send size={18} className="translate-x-0.5" />
          </motion.button>
        </div>
        
        {/* AI Status */}
        <div className="flex items-center justify-center gap-2 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-[11px] text-white/30 font-medium">
              Powered by Müsait AI
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Design2GlassmorphicDark() {
  return (
    <div className="w-full h-[85vh] max-h-[800px] flex">
      {/* Mobile View */}
      <div 
        className="lg:hidden w-full max-w-[420px] mx-auto rounded-[2.5rem] overflow-hidden flex flex-col relative"
        style={{
          background: "linear-gradient(135deg, #1a1625 0%, #0f0a1a 50%, #0d0815 100%)",
        }}
      >
        <ChatPanel showBackButton={true} />
      </div>
      
      {/* Desktop View */}
      <div 
        className="hidden lg:flex w-full max-w-[1100px] mx-auto rounded-[2rem] overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1a1625 0%, #0f0a1a 50%, #0d0815 100%)",
        }}
      >
        <Sidebar />
        <ChatPanel showBackButton={false} />
      </div>
    </div>
  );
}
