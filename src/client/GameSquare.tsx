import React from "react";
import { BoardSection } from "../core/enums/BoardSection";
import { SquareConfigDataMap } from "../core/config/SquareData";
import { SquareInfo } from "./SquareInfo";
import { SquareType } from "../core/enums/SquareType";

interface Props {
  id: number;
}

export const GameSquare: React.FC<Props> = ({ id }) => {

  const section: BoardSection = SquareConfigDataMap.get(id)?.section!;
  const squareType: SquareType = SquareConfigDataMap.get(id)?.type!;

  const sectionMap = new Map<BoardSection, string>([
    [BoardSection.Top, "top"], [BoardSection.Right, "right"], [BoardSection.Left, "left"], [BoardSection.Bottom, "bottom"]
  ]);

  const squareTypeClass = new Map<SquareType, string>([
    [SquareType.Airport, "airport"], [SquareType.Chance, "chance"], [SquareType.Go, "passgo"],
    [SquareType.GoToJail, "go-to-jail"], [SquareType.Jail, "jail"], [SquareType.Property, "property"],
    [SquareType.CentralPark, "central-park"], [SquareType.Utility, "utility"]
  ]);

  const getContainerClassName = () => {
    return "container container-" + sectionMap.get(section);
  };

  const getSquareClassName = () => {
    return "square " + squareTypeClass.get(squareType);
  };

  const getSquareId = () => {
    return "game-square-" + id;
  };


  return (
    <div className={getSquareClassName()} id={getSquareId()}>
      <div className={getContainerClassName()}>
        <SquareInfo id={id} />
      </div>
    </div>
  );

};
