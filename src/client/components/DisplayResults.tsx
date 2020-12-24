import React, { useEffect } from "react";
import { GameContext } from "../../core/types/GameContext";
import { GameEvent } from "../../core/types/GameEvent";
import { GameState } from "../../core/types/GameState";
import { getGameContextFromLocalStorage } from "../helpers";
import { SocketService } from "../sockets/SocketService";
import { AnimatedDice } from "./AnimatedDice";
import { Die } from "./Die";

interface Props {
  gameInfo: GameState | undefined;
  socketService: SocketService;
}

export const DisplayResults: React.FC<Props> = ({ gameInfo, socketService }) => {

  const context: GameContext = getGameContextFromLocalStorage();
  const [showDiceAnimation, setShowDiceAnimation] = React.useState(false);


  useEffect(() => {
    socketService.listenForEvent(GameEvent.ANIMATE_DICE, () => {
      setShowDiceAnimation(true);
    });

    socketService.listenForEvent(GameEvent.UPDATE_GAME_STATE, (data: any) => {
      setShowDiceAnimation(false);
    });
  }, [context.gameId]);


  const getResults = () => {
    return (
      <React.Fragment>

        <div className="dice-roll">
          <Die key={1} value={gameInfo!.results.roll.die1} />
          <Die key={2} value={gameInfo!.results.roll.die2} />
        </div>

        <div className="description">
          what happend: {gameInfo?.results.description}
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