import React, { useEffect } from "react";
import { DiceRollResult } from "../../core/types/DiceRollResult";
import { GameEvent } from "../../core/types/GameEvent";
import { GameState } from "../../core/types/GameState";
import { diceRollSound } from "../gameSounds";
import useGameStateStore from "../gameStateStore";
import { SocketService } from "../sockets/SocketService";
import { AnimatedDice } from "./AnimatedDice";
import { Die } from "./Die";
import { useIsMountedRef } from "./useIsMountedRef";


interface Props {
  socketService: SocketService;
}

export const DisplayResults: React.FC<Props> = ({ socketService }) => {

  const [showDiceAnimation, setShowDiceAnimation] = React.useState(false);
  const [animDiceRollResult, setAnimDiceRollResult] = React.useState<DiceRollResult | undefined>(undefined);


  const gameState = useGameStateStore(state => state.data);
  const showMovementAnimation = useGameStateStore(state => state.showMovementAnimation);

  const [resultsDesc, setResultsDesc] = React.useState<string | undefined>(gameState && gameState.results ? gameState.results.description : undefined);

  const isMountedRef = useIsMountedRef();

  useEffect(() => {
    if (!isMountedRef.current) {
      return;
    }
    socketService.listenForEvent(GameEvent.ANIMATE_DICE, () => {
      setShowDiceAnimation(true);
      setResultsDesc("");
      diceRollSound.play();
    });

    socketService.listenForEvent(GameEvent.STOP_ANIMATE_DICE, (playerId: string, diceRoll: DiceRollResult, frames: Array<number>) => {
      setAnimDiceRollResult(diceRoll);
      setShowDiceAnimation(false);
      showMovementAnimation(playerId, frames);
    });

    socketService.listenForEvent(GameEvent.UPDATE_GAME_STATE, (data: GameState) => {
      setShowDiceAnimation(false);
      setAnimDiceRollResult(undefined);
      if (data && data.results) {
        setResultsDesc(data.results.description);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const getDiceResults = (): DiceRollResult => {
    if (animDiceRollResult) {
      return animDiceRollResult;
    }

    if (!gameState) {
      return { die1: 1, die2: 1 };
    }

    return { die1: gameState.results.roll.die1, die2: gameState.results.roll.die2 };
  }

  const getResults = () => {
    const result = getDiceResults();
    return (
      <React.Fragment>

        <div className="dice-roll">
          <Die key={1} value={result.die1} />
          <Die key={2} value={result.die2} />
        </div>

        <div className="description" dangerouslySetInnerHTML={{ __html: resultsDesc ? resultsDesc : "" }}>
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
      {gameState && !showDiceAnimation && gameState.results ? getResults() : getEmptyResults()}
    </React.Fragment>
  );

};
