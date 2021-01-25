import React from "react";
import { GameState } from "../../core/types/GameState";
import { Player } from "../../core/types/Player";
import { DisplayPlayer } from "./DisplayPlayer";
import { getObjectIdAsHexString } from "../helpers";

interface Props {
  gameInfo: GameState | undefined;
  getPing: (userId: string | undefined) => string;
  viewPlayer: (player: Player) => void;
  tradeWithPlayer: (player: Player) => void;
  clearPlayer: () => void;
}

export const DisplayPlayers: React.FC<Props> = ({ gameInfo, getPing, viewPlayer, clearPlayer, tradeWithPlayer }) => {

  return (
    <React.Fragment>
      <div className="players-display">
        {gameInfo?.players.map((p: Player, index) => {
          return (<DisplayPlayer tradeWithPlayer={tradeWithPlayer} gameInfo={gameInfo} player={p} key={getObjectIdAsHexString(p._id)} getPing={getPing} viewPlayer={viewPlayer} clearPlayer={clearPlayer} />)
        })}
      </div>
    </React.Fragment>
  );

};
