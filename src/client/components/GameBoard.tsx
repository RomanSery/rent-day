import React from "react";
import { GameState } from "../../core/types/GameState";
import { CenterDisplay } from "./CenterDisplay";
import { GameSquare } from "./GameSquare";


interface Props {
  /*gameInstance: GameState;*/
}

export const GameBoard: React.FC<Props> = () => {

  const num_squares: Array<number> = Array.from(Array(40));

  return (
    <React.Fragment>
      <div className="board">

        {num_squares.map((n, index) => {
          const id: number = index + 1;

          return (<GameSquare
            id={id}
            key={id}
          />)
        })}


        <CenterDisplay />
      </div>
    </React.Fragment>
  );
}
