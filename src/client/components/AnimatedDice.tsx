import { motion, useReducedMotion } from "framer-motion";
import React from "react";
import { Die } from "./Die";

/** a face different from the current one, so every tick visibly changes */
const nextFace = (current: number): number => {
  const n = 1 + Math.floor(Math.random() * 5);
  return n >= current ? n + 1 : n;
};

/**
 * The dice while a roll is in flight (until the server sends the result):
 * each die flips through random faces and wobbles, slightly out of step with
 * the other so they don't move as one. DisplayResults swaps in the real
 * result, which lands with a small bounce (see Die).
 */
export const AnimatedDice: React.FC = () => {

  const reduceMotion = useReducedMotion();
  const [faces, setFaces] = React.useState<[number, number]>(() => [
    1 + Math.floor(Math.random() * 6),
    1 + Math.floor(Math.random() * 6),
  ]);

  React.useEffect(() => {
    const t = setInterval(() => {
      setFaces(([a, b]) => [nextFace(a), nextFace(b)]);
    }, reduceMotion ? 250 : 85);
    return () => clearInterval(t);
  }, [reduceMotion]);

  const tumble = (duration: number, delay: number) => (reduceMotion ? {} : {
    animate: { rotate: [0, -22, 14, -9, 0], y: [0, -7, 0, -3, 0] },
    transition: { duration, delay, repeat: Infinity, ease: "easeInOut" as const },
  });

  return (
    <div className="animated-die-container" aria-label="Rolling the dice">
      <motion.div {...tumble(0.42, 0)}>
        <Die value={faces[0]} />
      </motion.div>
      <motion.div {...tumble(0.5, 0.08)}>
        <Die value={faces[1]} />
      </motion.div>
    </div>
  );
};
