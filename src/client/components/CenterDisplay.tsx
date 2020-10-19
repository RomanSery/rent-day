import React from "react";
import { DisplayPlayers } from "./DisplayPlayers";
import { GameState } from "../../core/types/GameState";
import { DisplayActions } from "./DisplayActions";

interface Props {
  gameInfo: GameState | undefined;
}

export const CenterDisplay: React.FC<Props> = ({ gameInfo }) => {

  return (
    <React.Fragment>
      <div className="center-square square">
        <DisplayActions gameInfo={gameInfo} />
        <DisplayPlayers gameInfo={gameInfo} />

      </div>
    </React.Fragment>
  );

};
