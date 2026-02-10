import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

// ... keep existing code (CELEBRATION_EMOJIS, CONFETTI_COLORS, Particle interface, isCelebrationMessage)
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

const SNOW_EMOJIS = ["❄️", "☃️", "⛄", "🌨️", "🏔️"];
const FIRE_EMOJIS = ["🔥"];

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

export function isSnowMessage(content: string | null): boolean {
  if (!content) return false;
  return SNOW_EMOJIS.some((e) => content.includes(e));
}

export function isFireMessage(content: string | null): boolean {
  if (!content) return false;
  return FIRE_EMOJIS.some((e) => content.includes(e));
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
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 9999 }}>
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

interface Snowflake {
  id: number;
  x: number;
  delay: number;
  duration: number;
  size: number;
  drift: number;
  opacity: number;
}

export function SnowFall({ onDone }: { onDone: () => void }) {
  const [flakes] = useState<Snowflake[]>(() =>
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 3 + Math.random() * 3,
      size: 8 + Math.random() * 16,
      drift: (Math.random() - 0.5) * 80,
      opacity: 0.5 + Math.random() * 0.5,
    }))
  );

  useEffect(() => {
    const timer = setTimeout(onDone, 6000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return createPortal(
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 9999 }}>
      {flakes.map((f) => (
        <div
          key={f.id}
          className="snowflake-particle"
          style={{
            left: `${f.x}%`,
            fontSize: f.size,
            animationDelay: `${f.delay}s`,
            animationDuration: `${f.duration}s`,
            opacity: f.opacity,
            "--snow-drift": `${f.drift}px`,
          } as React.CSSProperties}
        >
          ❄
        </div>
      ))}
    </div>,
    document.body
  );
}

export function useConfetti() {
  const [active, setActive] = useState(false);
  const trigger = useCallback(() => setActive(true), []);
  const element = active ? <ConfettiRain onDone={() => setActive(false)} /> : null;
  return { trigger, element };
}

export function useSnow() {
  const [active, setActive] = useState(false);
  const trigger = useCallback(() => setActive(true), []);
  const element = active ? <SnowFall onDone={() => setActive(false)} /> : null;
  return { trigger, element };
}

interface FireParticle {
  id: number;
  x: number;
  delay: number;
  duration: number;
  size: number;
  drift: number;
  hue: number;
}

export function FireRise({ onDone }: { onDone: () => void }) {
  const [particles] = useState<FireParticle[]>(() =>
    Array.from({ length: 45 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 1.2,
      duration: 1.5 + Math.random() * 2,
      size: 10 + Math.random() * 20,
      drift: (Math.random() - 0.5) * 60,
      hue: Math.random() * 40, // 0 = red, 40 = orange-yellow
    }))
  );

  useEffect(() => {
    const timer = setTimeout(onDone, 4500);
    return () => clearTimeout(timer);
  }, [onDone]);

  return createPortal(
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 9999 }}>
      {particles.map((p) => (
        <div
          key={p.id}
          className="fire-particle"
          style={{
            left: `${p.x}%`,
            fontSize: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            "--fire-drift": `${p.drift}px`,
            "--fire-hue": p.hue,
          } as React.CSSProperties}
        >
          🔥
        </div>
      ))}
      <div className="fire-glow-bar" />
    </div>,
    document.body
  );
}

export function useFire() {
  const [active, setActive] = useState(false);
  const trigger = useCallback(() => setActive(true), []);
  const element = active ? <FireRise onDone={() => setActive(false)} /> : null;
  return { trigger, element };
}
