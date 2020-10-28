import React from "react";
import { DisplayPlayers } from "./DisplayPlayers";
import { GameState } from "../../core/types/GameState";
import { DisplayActions } from "./DisplayActions";

interface Props {
  gameInfo: GameState | undefined;
  onChangeGameState: (newGameState: GameState) => void;
}

export const CenterDisplay: React.FC<Props> = ({ gameInfo, onChangeGameState }) => {

  console.log(gameInfo?.theme);

  return (
    <React.Fragment>
      <div className="center-square square">
        <DisplayActions gameInfo={gameInfo} onChangeGameState={onChangeGameState} />
        <DisplayPlayers gameInfo={gameInfo} />

      </div>
    </React.Fragment>
  );

};
