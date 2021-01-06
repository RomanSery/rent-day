import React from "react";
import mongoose from "mongoose";
import { GameState } from "../../core/types/GameState";
import { Player } from "../../core/types/Player";
import { DisplayPlayer } from "./DisplayPlayer";

interface Props {
  gameInfo: GameState | undefined;
  getPing: (userId: mongoose.Types.ObjectId | undefined) => string;
  viewPlayer: (player: Player) => void;
  clearPlayer: () => void;
}

export const DisplayPlayers: React.FC<Props> = ({ gameInfo, getPing, viewPlayer, clearPlayer }) => {

  return (
    <React.Fragment>
      <div className="players-display">
        {gameInfo?.players.map((p: Player, index) => {
          return (<DisplayPlayer gameInfo={gameInfo} player={p} key={p._id.toHexString()} getPing={getPing} viewPlayer={viewPlayer} clearPlayer={clearPlayer} />)
        })}
      </div>
    </React.Fragment>
  );

};
