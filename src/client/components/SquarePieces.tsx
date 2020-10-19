import React from "react";
import { GameState } from "../../core/types/GameState";
import { GamePiece } from "./GamePiece";
import { PieceType } from "../../core/enums/PieceType";

interface Props {
  id: number;
  gameInfo: GameState | undefined;
  cssName: string
}

export const SquarePieces: React.FC<Props> = ({ id, gameInfo, cssName }) => {


  return (
    <React.Fragment>
      <div className={cssName}>
        {gameInfo?.players.map((p, index) => {
          const pos: number = p.position;
          if (pos == id) {
            return (<GamePiece type={p.type} color={p.color} />)
          }
        })}
      </div>
    </React.Fragment>
  );

};
