import { motion } from "framer-motion";
import React from "react";

interface Props {

}

export const AnimatedDice: React.FC<Props> = () => {

  const Pip = () => {
    return <span className="pip" />;
  }

  const pips = Array(6).fill(0).map((_, i) => <Pip key={i} />);

  return (
    <React.Fragment>
      <div className="animated-die-container">

        <motion.div
          animate={{
            rotateZ: [0, 90, 180, 270, 360]
          }}
          transition={{
            duration: 0.5,
            loop: 5,
            repeatDelay: 0
          }}
          style={{ originX: 0.5 }}
          onAnimationComplete={() => console.log("here")}
        >
          <div className="die-face">{pips}</div>
        </motion.div>

        <motion.div
          animate={{
            rotateZ: [360, 270, 180, 90, 0]
          }}
          transition={{
            duration: 0.5,
            loop: 5,
            repeatDelay: 0
          }}
          style={{ originX: 0.5 }}
        >
          <div className="die-face">{pips}</div>
        </motion.div>

      </div>

    </React.Fragment>
  );


};
