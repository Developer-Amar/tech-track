"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";

interface BentoCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  glowColor?: "signal" | "purple" | "danger" | "default";
}

export default function BentoCard({ children, className = "", delay = 0, glowColor = "default" }: BentoCardProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const getGlowColor = () => {
    switch (glowColor) {
      case "signal": return "rgba(125, 249, 255, 0.4)";
      case "purple": return "rgba(75, 0, 130, 0.6)";
      case "danger": return "rgba(239, 68, 68, 0.4)";
      default: return "rgba(255, 255, 255, 0.15)";
    }
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, type: "spring", stiffness: 100, damping: 20 }}
      whileHover={{ scale: 1.02 }}
      className={`relative overflow-hidden rounded-2xl glass-panel ${className}`}
    >
      {/* Glint Effect mapping to mouse */}
      {isHovered && (
        <div
          className="pointer-events-none absolute -inset-px z-0 transition-opacity duration-300"
          style={{
            background: `radial-gradient(400px circle at ${mousePosition.x}px ${mousePosition.y}px, ${getGlowColor()}, transparent 40%)`,
            opacity: 0.6,
          }}
        />
      )}
      
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </motion.div>
  );
}
