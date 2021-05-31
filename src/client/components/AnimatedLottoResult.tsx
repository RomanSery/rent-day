/* eslint-disable react-hooks/exhaustive-deps */
import { animate, useMotionValue } from "framer-motion";
import React, { useEffect, useState } from "react";
import LinearProgress from '@material-ui/core/LinearProgress';
import { GameEvent } from "../../core/types/GameEvent";
import { dollarFormatter } from "../helpers";
import { SocketService } from "../sockets/SocketService";
import { LottoState } from "../../core/types/LottoState";
import useGameStateStore from "../stores/gameStateStore";

interface Props {
  chanceToWin: number;
  randomNum: number;
  socketService: SocketService;
  lottoState: LottoState;
}

export const AnimatedLottoResult: React.FC<Props> = ({ chanceToWin, randomNum, socketService, lottoState }) => {

  const x = useMotionValue<number>(0);
  const [animValue, setAnimValue] = useState<number>(0);
  const [showResult, setShowResult] = useState<boolean>(false);

  const gameState = useGameStateStore(state => state.data);

  const getBufferValue = (): number => {
    return 100 - chanceToWin;
  };

  const getTargetValue = (): number => {
    return 100 - randomNum;
  };

  const getLottoResult = (): string => {
    if (!showResult) {
      return "";
    }
    if (lottoState && lottoState.prize > 0) {
      return "You Won " + dollarFormatter.format(lottoState.prize);
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
          if (socketService && gameState) {
            socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameState._id);
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
      <div className="lotto-animation">
        <LinearProgress variant="buffer" value={animValue} valueBuffer={getBufferValue()} />
      </div>
      <div className="lotto-result">
        {getLottoResult()}
      </div>
    </React.Fragment>
  );
};
