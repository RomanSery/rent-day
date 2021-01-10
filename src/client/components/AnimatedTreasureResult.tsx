/* eslint-disable react-hooks/exhaustive-deps */
import { animate, useMotionValue } from "framer-motion";
import React, { useEffect, useState } from "react";
import LinearProgress from '@material-ui/core/LinearProgress';
import { GameEvent } from "../../core/types/GameEvent";
import { getMyGameId } from "../helpers";
import { SocketService } from "../sockets/SocketService";
import { TreasureState } from "../../core/types/TreasureState";

interface Props {
  chanceToWin: number;
  randomNum: number;
  socketService: SocketService;
  treasureState: TreasureState;
}

export const AnimatedTreasureResult: React.FC<Props> = ({ chanceToWin, randomNum, socketService, treasureState }) => {

  const x = useMotionValue<number>(0);
  const [animValue, setAnimValue] = useState<number>(0);
  const [showResult, setShowResult] = useState<boolean>(false);

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

  const getTreasureResult = (): string => {
    if (!showResult) {
      return "";
    }
    if (treasureState && treasureState.prize > 0) {
      return "You Won $" + treasureState.prize;
    }
    return "You lost, better luck next time!"
  };

  useEffect(() => {
    const controls = animate(x, getTargetValue(), {
      type: "tween",
      duration: 8,
      onUpdate: (value: number) => {
        setAnimValue(Math.round(value))
      },
      onComplete: () => {
        setShowResult(true);

        setTimeout(() => {
          if (socketService) {
            socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, getMyGameId());
          }
        }, 3000);
      }
    });

    return function cleanup() {
      if (controls) {
        controls.stop();
      }
    };
  }, []);

  return (
    <React.Fragment>
      <div className="treasure-animation">
        <LinearProgress variant="buffer" value={animValue} valueBuffer={getBufferValue()} />
      </div>
      <div className="treasure-result">
        {getTreasureResult()}
      </div>
    </React.Fragment>
  );
};
