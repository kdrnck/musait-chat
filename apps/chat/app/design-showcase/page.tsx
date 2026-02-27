"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Keyboard } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Check, X } from "lucide-react";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

import Design1MonochromeLuxe from "./designs/Design1MonochromeLuxe";
import Design2GlassmorphicDark from "./designs/Design2GlassmorphicDark";
import Design3SoftSunrise from "./designs/Design3SoftSunrise";
import Design4Brutalist from "./designs/Design4Brutalist";
import Design5Neumorphic from "./designs/Design5Neumorphic";
import Design6EmeraldEditorial from "./designs/Design6EmeraldEditorial";

const designs = [
  {
    id: 1,
    name: "Monochrome Luxe",
    description: "Ultra-minimal, elegant black & white with serif accents",
    tags: ["Minimal", "Elegant", "Professional"],
    accent: "#000000",
  },
  {
    id: 2,
    name: "Glassmorphic Dark",
    description: "Dark mode with frosted glass effects and vibrant accents",
    tags: ["Modern", "Dark", "Glassmorphism"],
    accent: "#8B5CF6",
  },
  {
    id: 3,
    name: "Soft Sunrise",
    description: "Warm gradients with soft pastels, friendly and approachable",
    tags: ["Warm", "Friendly", "Gradient"],
    accent: "#F97316",
  },
  {
    id: 4,
    name: "Brutalist Raw",
    description: "High contrast, bold typography, stark black lines with green accents",
    tags: ["Brutalist", "Monospace", "Bold"],
    accent: "#7CF854",
  },
  {
    id: 5,
    name: "Neumorphic Soft",
    description: "Extruded physical forms with very soft light and shadows",
    tags: ["Neomorphism", "Soft", "Tactile"],
    accent: "#A3B1C6",
  },
  {
    id: 6,
    name: "Emerald Editorial",
    description: "Dark, expensive magazine feel with beautiful serif typography",
    tags: ["Editorial", "Dark", "Serif"],
    accent: "#0a160d",
  },
];

export default function DesignShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedDesigns, setSelectedDesigns] = useState<number[]>([]);
  const swiperRef = useRef<SwiperType | null>(null);

  const currentDesign = designs[activeIndex];

  const toggleSelection = (id: number) => {
    setSelectedDesigns((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const handlePrev = useCallback(() => {
    swiperRef.current?.slidePrev();
  }, []);

  const handleNext = useCallback(() => {
    swiperRef.current?.slideNext();
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleSelection(currentDesign.id);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrev, handleNext, currentDesign.id]);

  return (
    <div className="min-h-screen bg-neutral-950 text-white overflow-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between bg-gradient-to-b from-neutral-950 via-neutral-950/90 to-transparent">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Chat UI Designs</h1>
          <p className="text-sm text-neutral-500">← → ile gezin, Space ile seçin</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <span>Seçili:</span>
            <span className="font-mono text-white">{selectedDesigns.length}</span>
          </div>
          {selectedDesigns.length > 0 && (
            <motion.button
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="px-4 py-2 bg-white text-black rounded-full text-sm font-medium hover:bg-neutral-200 transition-colors"
            >
              Seçilenleri Uygula
            </motion.button>
          )}
        </div>
      </header>

      {/* Design Info Panel */}
      <div className="fixed bottom-0 left-0 right-0 z-50 px-6 py-6 bg-gradient-to-t from-neutral-950 via-neutral-950/95 to-transparent">
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentDesign.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="flex items-end justify-between"
            >
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: currentDesign.accent }}
                  />
                  <h2 className="text-2xl font-bold tracking-tight">
                    {currentDesign.name}
                  </h2>
                  <span className="text-neutral-500 font-mono text-sm">
                    {activeIndex + 1}/{designs.length}
                  </span>
                </div>
                <p className="text-neutral-400 mb-3 max-w-md">
                  {currentDesign.description}
                </p>
                <div className="flex gap-2">
                  {currentDesign.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 text-xs font-medium rounded-full bg-neutral-800 text-neutral-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Navigation Arrows */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrev}
                    disabled={activeIndex === 0}
                    className="w-12 h-12 rounded-full bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all"
                    aria-label="Önceki tasarım"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={activeIndex === designs.length - 1}
                    className="w-12 h-12 rounded-full bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all"
                    aria-label="Sonraki tasarım"
                  >
                    <ChevronRight size={24} />
                  </button>
                </div>

                {/* Select / Deselect */}
                <button
                  onClick={() => toggleSelection(currentDesign.id)}
                  className={`px-6 py-3 rounded-full font-medium text-sm flex items-center gap-2 transition-all ${selectedDesigns.includes(currentDesign.id)
                      ? "bg-green-500 text-white hover:bg-green-600"
                      : "bg-neutral-800 text-white hover:bg-neutral-700"
                    }`}
                  aria-label={selectedDesigns.includes(currentDesign.id) ? "Seçimi kaldır" : "Seç"}
                >
                  {selectedDesigns.includes(currentDesign.id) ? (
                    <>
                      <Check size={18} />
                      <span>Seçildi</span>
                    </>
                  ) : (
                    <span>Bu Tasarımı Seç</span>
                  )}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Progress Dots */}
      <div className="fixed left-1/2 -translate-x-1/2 bottom-36 z-50 flex items-center gap-2">
        {designs.map((design, idx) => (
          <button
            key={design.id}
            onClick={() => swiperRef.current?.slideTo(idx)}
            className={`transition-all duration-300 ${idx === activeIndex
                ? "w-8 h-2 rounded-full"
                : "w-2 h-2 rounded-full hover:opacity-80"
              }`}
            style={{
              backgroundColor: idx === activeIndex ? design.accent : "#525252",
            }}
            aria-label={`${design.name} tasarımına git`}
          />
        ))}
      </div>

      {/* Swiper */}
      <Swiper
        modules={[Navigation, Pagination, Keyboard]}
        spaceBetween={0}
        slidesPerView={1}
        keyboard={{ enabled: true }}
        onSwiper={(swiper) => (swiperRef.current = swiper)}
        onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
        className="h-screen w-full"
      >
        <SwiperSlide>
          <div className="h-full w-full flex items-center justify-center p-4 pt-20 pb-44">
            <Design1MonochromeLuxe />
          </div>
        </SwiperSlide>
        <SwiperSlide>
          <div className="h-full w-full flex items-center justify-center p-4 pt-20 pb-44">
            <Design2GlassmorphicDark />
          </div>
        </SwiperSlide>
        <SwiperSlide>
          <div className="h-full w-full flex items-center justify-center p-4 pt-20 pb-44">
            <Design3SoftSunrise />
          </div>
        </SwiperSlide>
        <SwiperSlide>
          <div className="h-full w-full flex items-center justify-center p-4 pt-20 pb-44">
            <Design4Brutalist />
          </div>
        </SwiperSlide>
        <SwiperSlide>
          <div className="h-full w-full flex items-center justify-center p-4 pt-20 pb-44">
            <Design5Neumorphic />
          </div>
        </SwiperSlide>
        <SwiperSlide>
          <div className="h-full w-full flex items-center justify-center p-4 pt-20 pb-44">
            <Design6EmeraldEditorial />
          </div>
        </SwiperSlide>
      </Swiper>
    </div>
  );
}
