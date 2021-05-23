import React from "react";
import { Player } from "../../core/types/Player";
import { DisplayPlayer } from "./DisplayPlayer";
import { getObjectIdAsHexString } from "../helpers";
import useGameStateStore from "../gameStateStore";

interface Props {
  viewPlayer: (player: Player) => void;
  clearPlayer: () => void;
}

export const DisplayPlayers: React.FC<Props> = ({ viewPlayer, clearPlayer }) => {

  const gameState = useGameStateStore(state => state.data);

  return (
    <React.Fragment>
      <div className="players-display">
        {gameState?.players.map((p: Player, index) => {
          return (<DisplayPlayer player={p} key={getObjectIdAsHexString(p._id)} viewPlayer={viewPlayer} clearPlayer={clearPlayer} />)
        })}
      </div>
    </React.Fragment>
  );

};
