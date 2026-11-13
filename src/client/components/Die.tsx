import React from "react";
import { motion, useReducedMotion } from "framer-motion";

interface Props {
  value: number;
  /** just rolled: settle onto the board with a small bounce */
  land?: boolean;
}

export const Die: React.FC<Props> = ({ value, land }) => {

  const reduceMotion = useReducedMotion();

  const pips = Number.isInteger(value)
    ? Array(value).fill(0).map((_, i) => <span key={i} className="pip" />)
    : null;

  if (!land || reduceMotion) {
    return <div className="die-face" aria-label={"Die showing " + value}>{pips}</div>;
  }

  return (
    <motion.div className="die-face" aria-label={"Die showing " + value}
      initial={{ scale: 1.25, rotate: -18 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 14 }}>
      {pips}
    </motion.div>
  );

};
