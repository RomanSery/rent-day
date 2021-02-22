import React, { useEffect } from "react";
import { DiceRollResult } from "../../core/types/DiceRollResult";
import { GameEvent } from "../../core/types/GameEvent";
import { GameState } from "../../core/types/GameState";
import { SocketService } from "../sockets/SocketService";
import { AnimatedDice } from "./AnimatedDice";
import { Die } from "./Die";
import { useIsMountedRef } from "./useIsMountedRef";

interface Props {
  gameInfo: GameState | undefined;
  socketService: SocketService;
}

export const DisplayResults: React.FC<Props> = ({ gameInfo, socketService }) => {

  const [showDiceAnimation, setShowDiceAnimation] = React.useState(false);
  const [animDiceRollResult, setAnimDiceRollResult] = React.useState<DiceRollResult | undefined>(undefined);
  const isMountedRef = useIsMountedRef();

  useEffect(() => {
    if (!isMountedRef.current) {
      return;
    }
    socketService.listenForEvent(GameEvent.ANIMATE_DICE, () => {
      setShowDiceAnimation(true);
    });
    socketService.listenForEvent(GameEvent.STOP_ANIMATE_DICE, (diceRoll: DiceRollResult) => {
      setAnimDiceRollResult(diceRoll);
      setShowDiceAnimation(false);
    });

    socketService.listenForEvent(GameEvent.UPDATE_GAME_STATE, (data: any) => {
      setShowDiceAnimation(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getDiceResults = (): DiceRollResult => {
    if (animDiceRollResult) {
      return animDiceRollResult;
    }

    if (!gameInfo) {
      return { die1: 1, die2: 1 };
    }

    return { die1: gameInfo.results.roll.die1, die2: gameInfo.results.roll.die2 };
  }


  const getResults = () => {
    const result = getDiceResults();
    return (
      <React.Fragment>

        <div className="dice-roll">
          <Die key={1} value={result.die1} />
          <Die key={2} value={result.die2} />
        </div>

        <div className="description" dangerouslySetInnerHTML={{ __html: gameInfo?.results.description ? gameInfo?.results.description : "" }}>
        </div>

      </React.Fragment>
    );
  }

  const getEmptyResults = () => {
    return (
      <React.Fragment>
        <div className="dice-roll">

        </div>
        <div className="description">

        </div>
      </React.Fragment>
    );
  }


  return (
    <React.Fragment>
      {showDiceAnimation ? <AnimatedDice key={5} /> : null}
      {gameInfo && !showDiceAnimation && gameInfo.results ? getResults() : getEmptyResults()}
    </React.Fragment>
  );

};
