import React from "react";
import { GameState } from "../../core/types/GameState";
import { Player } from "../../core/types/Player";
import { DisplayPlayer } from "./DisplayPlayer";
import { getObjectIdAsHexString } from "../helpers";

interface Props {
  gameInfo: GameState | undefined;
  getPing: (userId: string | undefined) => string;
  viewPlayer: (player: Player) => void;
  clearPlayer: () => void;
}

export const DisplayPlayers: React.FC<Props> = ({ gameInfo, getPing, viewPlayer, clearPlayer }) => {

  return (
    <React.Fragment>
      <div className="players-display">
        {gameInfo?.players.map((p: Player, index) => {
          return (<DisplayPlayer gameInfo={gameInfo} player={p} key={getObjectIdAsHexString(p._id)} getPing={getPing} viewPlayer={viewPlayer} clearPlayer={clearPlayer} />)
        })}
      </div>
    </React.Fragment>
  );

};
