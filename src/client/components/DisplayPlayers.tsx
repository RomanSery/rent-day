import React from "react";
import { GameState } from "../../core/types/GameState";
import { Player } from "../../core/types/Player";
import { DisplayPlayer } from "./DisplayPlayer";

interface Props {
  gameInfo: GameState | undefined;
}

export const DisplayPlayers: React.FC<Props> = ({ gameInfo }) => {

  return (
    <React.Fragment>
      <div className="players-display">
        {gameInfo?.players.map((p: Player, index) => {
          return (<DisplayPlayer gameInfo={gameInfo} player={p} key={p._id} />)
        })}
      </div>
    </React.Fragment>
  );

};
