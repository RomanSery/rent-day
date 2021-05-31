import React from "react";
import { GameSquare } from "../components/GameSquare";


interface Props {

}

export const StaticBoard: React.FC<Props> = (props) => {

  const num_squares: Array<number> = Array.from(Array(40));

  /*
  const createEmptyState = (): GameState => {

    let themeArray: Array<SquareThemeData> = [];
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
      _id: '', auctionId: '', auctionSquareId: 0, lottoId: '',
      theme: themeArray, players: [], status: GameStatus.FINISHED,
      nextPlayerToAct: '',
      name: 'static', messages: [], log: [], gameLength: 0, winner: '',
      settings: {
        maxPlayers: 0, initialMoney: 0, password: '', initialSkillPoints: 0,
      }, results: { roll: { die1: 1, die2: 1 }, description: '' }, squareState: []
    };
  }*/

  return (
    <React.Fragment>
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
    </React.Fragment>
  );
}
