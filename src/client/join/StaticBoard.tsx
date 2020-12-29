import React from "react";
import { GameState } from "../../core/types/GameState";
import { GameSquare } from "../components/GameSquare";
import { SquareThemeData } from "../../core/types/SquareThemeData";
import { NyThemeData } from "../../core/config/NyTheme";
import _ from "lodash";

interface Props {

}

export const StaticBoard: React.FC<Props> = (props) => {

  const num_squares: Array<number> = Array.from(Array(40));

  const createEmptyState = (): GameState => {

    let themeArray: Array<SquareThemeData> = new Array();
    themeArray.push({ name: "" });
    for (let i = 1; i <= 40; i++) {
      const data: SquareThemeData | undefined = NyThemeData.get(i);
      if (data != null) {
        themeArray.push(data);
      } else {
        themeArray.push({ name: "" });
      }
    }
    return {
      id: '', auctionId: '', theme: themeArray, players: [], nextPlayerToAct: '', name: 'static', settings: {
        maxPlayers: 0, initialMoney: 0
      }, results: { roll: { die1: 1, die2: 1 }, description: '' }, squareState: []
    };
  }

  const viewSquare = (id: number) => {

  };
  const clearSquare = () => {

  };



  return (
    <React.Fragment>
      <div className="board">
        {num_squares.map((n, index) => {
          const id: number = index + 1;
          return (<GameSquare gameInfo={createEmptyState()}
            id={id}
            key={id} viewSquare={viewSquare} clearSquare={clearSquare}
          />)
        })}

        <div className="center-square square">
          {props.children}
        </div>

      </div>
    </React.Fragment>
  );
}
