import { animate, useMotionValue } from "framer-motion";
import React, { useEffect, useState } from "react";
import LinearProgress from '@material-ui/core/LinearProgress';

interface Props {
  chanceToWin: number;
  randomNum: number;
}

export const AnimatedTreasureResult: React.FC<Props> = ({ chanceToWin, randomNum }) => {

  const x = useMotionValue<number>(0);
  const [animValue, setAnimValue] = useState<number>(0);

  const getBufferValue = (): number => {
    if (chanceToWin > 50) {
      return chanceToWin;
    }
    return 100 - chanceToWin;
  };

  const getTargetValue = (): number => {
    if (chanceToWin > 50) {
      return randomNum;
    }
    return 100 - randomNum;
  };


  useEffect(() => {
    console.log("target %s buffer %s", getTargetValue(), getBufferValue());
    const controls = animate(x, getTargetValue(), {
      type: "spring",
      duration: 3,
      onUpdate: (value: number) => {
        setAnimValue(Math.round(value))
      }
    });

    return function cleanup() {
      if (controls) {
        controls.stop();
      }
    };
  }, []);

  return (
    <LinearProgress variant="buffer" value={animValue} valueBuffer={getBufferValue()} />
  );
};
