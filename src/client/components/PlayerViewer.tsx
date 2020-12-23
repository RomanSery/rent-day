import React from "react";
import { GameState } from "../../core/types/GameState";
import { Player } from "../../core/types/Player";

interface Props {
  gameInfo: GameState | undefined;
  getPlayer: () => Player | undefined;
}

export const PlayerViewer: React.FC<Props> = ({ gameInfo, getPlayer }) => {

  const getPlayerName = () => {
    const p = getPlayer();
    if (p) {
      return p.name;
    }
    return "";
  }


  return (
    <React.Fragment>
      <div>
        Player name: {getPlayerName()}
      </div>

    </React.Fragment>
  );

};
