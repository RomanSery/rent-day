import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffectsStore } from "./effects";

interface Props {
  squareId: number;
}

/** Rent and building pops that float up from one board square. */
export const SquarePops: React.FC<Props> = ({ squareId }) => {
  const allPops = useEffectsStore((s) => s.pops);
  const reduceMotion = useReducedMotion();
  const pops = allPops.filter((p) => p.squareId === squareId);

  return (
    <div className="square-pops" aria-live="polite">
      <AnimatePresence>
        {pops.map((p, i) => (
          <motion.span
            key={p.id}
            className={"square-pop square-pop-" + p.kind}
            style={{ background: p.color }}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.7 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: -18 - i * 22, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -40 - i * 22, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 22, opacity: { duration: 0.2 } }}
          >
            {p.text}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
};
