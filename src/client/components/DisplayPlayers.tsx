import React from "react";
import { GameState } from "../../core/types/GameState";
import { Player } from "../../core/types/Player";
import { DisplayPlayer } from "./DisplayPlayer";

interface Props {
  gameInfo: GameState | undefined;
  getPing: (playerId: string | undefined) => string;
}

export const DisplayPlayers: React.FC<Props> = ({ gameInfo, getPing }) => {

  return (
    <React.Fragment>
      <div className="players-display">
        {gameInfo?.players.map((p: Player, index) => {
          return (<DisplayPlayer gameInfo={gameInfo} player={p} key={p._id} getPing={getPing} />)
        })}
      </div>
    </React.Fragment>
  );

};
