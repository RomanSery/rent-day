import React from "react";
import { GameState } from "../../core/types/GameState";
import { SocketService } from "../sockets/SocketService";
import { Die } from "./Die";

interface Props {
  gameInfo: GameState | undefined;
  socketService: SocketService;
}

export const DisplayResults: React.FC<Props> = ({ gameInfo, socketService }) => {

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


  return (
    <React.Fragment>
      <div className="game-results">
        {gameInfo && gameInfo.results && getResults()}
      </div>
    </React.Fragment>
  );

};
