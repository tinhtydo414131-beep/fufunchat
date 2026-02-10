import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

const CELEBRATION_EMOJIS = ["🎉", "🥳", "🎊", "🎈", "🏆", "🥇", "🎆", "🎇", "✨"];
const CONFETTI_COLORS = [
  "hsl(270 70% 60%)",
  "hsl(220 80% 65%)",
  "hsl(310 70% 60%)",
  "hsl(25 90% 60%)",
  "hsl(170 55% 55%)",
  "hsl(40 95% 60%)",
  "hsl(185 70% 55%)",
  "hsl(0 80% 65%)",
];

interface Particle {
  id: number;
  x: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
  drift: number;
  rotation: number;
  type: "square" | "circle" | "strip";
}

export function isCelebrationMessage(content: string | null): boolean {
  if (!content) return false;
  return CELEBRATION_EMOJIS.some((e) => content.includes(e));
}

export function ConfettiRain({ onDone }: { onDone: () => void }) {
  const [particles] = useState<Particle[]>(() => {
    const count = 60;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      delay: Math.random() * 0.8,
      duration: 1.8 + Math.random() * 1.4,
      size: 6 + Math.random() * 8,
      drift: (Math.random() - 0.5) * 120,
      rotation: Math.random() * 720 - 360,
      type: (["square", "circle", "strip"] as const)[Math.floor(Math.random() * 3)],
    }));
  });

  useEffect(() => {
    const timer = setTimeout(onDone, 3500);
    return () => clearTimeout(timer);
  }, [onDone]);

  return createPortal(
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 9999 }}
    >
      {particles.map((p) => (
        <div
          key={p.id}
          className="confetti-particle"
          style={{
            left: `${p.x}%`,
            backgroundColor: p.color,
            width: p.type === "strip" ? p.size * 0.4 : p.size,
            height: p.type === "strip" ? p.size * 1.6 : p.size,
            borderRadius: p.type === "circle" ? "50%" : p.type === "strip" ? "2px" : "2px",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            "--confetti-drift": `${p.drift}px`,
            "--confetti-rotation": `${p.rotation}deg`,
          } as React.CSSProperties}
        />
      ))}
    </div>,
    document.body
  );
}

export function useConfetti() {
  const [active, setActive] = useState(false);

  const trigger = useCallback(() => {
    setActive(true);
  }, []);

  const element = active ? (
    <ConfettiRain onDone={() => setActive(false)} />
  ) : null;

  return { trigger, element };
}
