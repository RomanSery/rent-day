import React from "react";
import { BoardSection } from "../../core/enums/BoardSection";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { SquareInfo } from "./SquareInfo";
import { SquareType } from "../../core/enums/SquareType";
import { GameState } from "../../core/types/GameState";
import { SquarePieces } from "./SquarePieces";
import { SquareGameData } from "../../core/types/SquareGameData";

interface Props {
  id: number;
  gameInfo: GameState | undefined;
  viewSquare: (id: number) => void;
  clearSquare: () => void;
}

export const GameSquare: React.FC<Props> = ({ id, gameInfo, viewSquare, clearSquare }) => {

  const section: BoardSection = SquareConfigDataMap.get(id)?.section!;
  const squareType: SquareType = SquareConfigDataMap.get(id)?.type!;

  const sectionMap = new Map<BoardSection, string>([
    [BoardSection.Top, "top"], [BoardSection.Right, "right"], [BoardSection.Left, "left"], [BoardSection.Bottom, "bottom"]
  ]);

  const squareTypeClass = new Map<SquareType, string>([
    [SquareType.TrainStation, "train-station"], [SquareType.Chance, "chance"], [SquareType.PayDay, "payday"],
    [SquareType.GoToIsolation, "go-to-isolation"], [SquareType.Isolation, "isolation"], [SquareType.Property, "property"],
    [SquareType.CentralPark, "central-park"], [SquareType.Utility, "utility"], [SquareType.Treasure, "treasure"]
  ]);

  const getContainerClassName = () => {
    return "container container-" + sectionMap.get(section);
  };

  const getPiecesClassName = () => {
    return "pieces " + sectionMap.get(section);
  };

  const getSquareClassName = () => {
    return "square " + squareTypeClass.get(squareType) + (isMortgaged() ? " mortgaged" : "");
  };

  const getSquareId = () => {
    return "game-square-" + id;
  };

  const setSquareToView = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    viewSquare(id);
  };
  const leaveSquare = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    clearSquare();
  };

  const getSquareGameData = (): SquareGameData | undefined => {
    if (gameInfo && gameInfo.squareState) {
      return gameInfo.squareState.find((p: SquareGameData) => p.squareId === id);
    }
    return undefined;
  };

  const isMortgaged = (): boolean => {
    const data = getSquareGameData();
    return data && data.isMortgaged ? true : false;
  };


  return (
    <React.Fragment>
      <div className={getSquareClassName()} id={getSquareId()} onMouseEnter={setSquareToView} onMouseLeave={leaveSquare}>
        <SquarePieces gameInfo={gameInfo} cssName={getPiecesClassName()} id={id} />
        <div className={getContainerClassName()}>
          <SquareInfo id={id} gameInfo={gameInfo} />

        </div>
      </div>
    </React.Fragment>

  );


};
