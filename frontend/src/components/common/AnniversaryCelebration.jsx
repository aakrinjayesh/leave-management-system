import { useEffect, useMemo } from "react";
import "./AnniversaryCelebration.css";

const CONFETTI_COLORS = ["#6366f1", "#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#ec4899"];
const CONFETTI_COUNT = 40;
const BALLOON_COUNT = 8;

// Plays once, then calls onDone after 10s - the caller is responsible for
// only rendering this the first time an employee crosses a new anniversary.
export default function AnniversaryCelebration({ firstName, years, onDone }) {
  useEffect(() => {
    const timer = setTimeout(() => onDone?.(), 10000);
    return () => clearTimeout(timer);
  }, [onDone]);

  const confetti = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        duration: 2.6 + Math.random() * 1.6,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotate: Math.random() * 360,
      })),
    []
  );

  const balloons = useMemo(
    () =>
      Array.from({ length: BALLOON_COUNT }, (_, i) => ({
        id: i,
        left: 5 + i * (90 / BALLOON_COUNT) + (Math.random() * 6 - 3),
        delay: Math.random() * 1.5,
        duration: 5 + Math.random() * 2,
      })),
    []
  );

  return (
    <div className="celebration-overlay" role="status" aria-live="polite">
      {confetti.map((c) => (
        <span
          key={c.id}
          className="celebration-confetti"
          style={{
            left: `${c.left}%`,
            backgroundColor: c.color,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.duration}s`,
            transform: `rotate(${c.rotate}deg)`,
          }}
        />
      ))}

      {balloons.map((b) => (
        <span
          key={b.id}
          className="celebration-balloon"
          style={{ left: `${b.left}%`, animationDelay: `${b.delay}s`, animationDuration: `${b.duration}s` }}
        >
          🎈
        </span>
      ))}

      <div className="celebration-card">
        <div className="celebration-emoji">🎉</div>
        <h2>Congratulations{firstName ? `, ${firstName}` : ""}!</h2>
        <p>
          You've completed {years} year{years !== 1 ? "s" : ""} with Aakrin. Thank you for being part of the team!
        </p>
      </div>
    </div>
  );
}
