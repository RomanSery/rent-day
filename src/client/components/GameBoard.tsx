import React from "react";
import { CenterDisplay } from "./CenterDisplay";
import { GameSquare } from "./GameSquare";

export default function GameBoard() {
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
