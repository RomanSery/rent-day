import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { GameContext } from "../../core/types/GameContext";
import { GameState } from "../../core/types/GameState";
import { getGameContextFromUrl } from "../api";
import { GameSquare } from "./GameSquare";
import API from '../api';
import { CenterDisplay } from "./CenterDisplay";

interface Props {

}

export const GameBoard: React.FC<Props> = () => {

  const num_squares: Array<number> = Array.from(Array(40));
  const location = useLocation();
  const context: GameContext = getGameContextFromUrl(location.search);

  const [gameState, setGameState] = useState<GameState>();

  useEffect(() => {
    getGameState();
  }, [context.gameId, context.playerId])


  const getGameState = () => {
    API.post("getGame", { gameId: context.gameId })
      .then(function (response) {
        setGameState(response.data.game);
      })
      .catch(function (error) {
        console.log(error);
      });
  };

  const onGameStateChanged = (newGameState: GameState) => {
    console.log(newGameState);
    setGameState(newGameState);
  }

  return (
    <React.Fragment>
      <div className="board">

        {num_squares.map((n, index) => {
          const id: number = index + 1;

          return (<GameSquare gameInfo={gameState}
            id={id}
            key={id}
          />)
        })}

        <CenterDisplay gameInfo={gameState} onChangeGameState={onGameStateChanged} />
      </div>
    </React.Fragment>
  );
}
