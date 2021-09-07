import React from "react";
import { GameSquare } from "../components/GameSquare";


interface Props {

}

export const StaticBoard: React.FC<Props> = (props) => {

  const num_squares: Array<number> = Array.from(Array(40));

  return (
    
      <div className="board">
        {num_squares.map((n, index) => {
          const id: number = index + 1;
          return (<GameSquare
            id={id}
            key={id} viewSquare={() => { }}
          />)
        })}

        <div className="center-square square">
          {props.children}
        </div>

      </div>
    
  );
}
