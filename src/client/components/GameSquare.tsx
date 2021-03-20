import React, { TouchEvent } from "react";
import { BoardSection } from "../../core/enums/BoardSection";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { SquareInfo } from "./SquareInfo";
import { SquareType } from "../../core/enums/SquareType";
import { GameState } from "../../core/types/GameState";
import { SquareGameData } from "../../core/types/SquareGameData";
import { areObjectIdsEqual } from "../helpers";
import { player_colors_to_rgb } from "../../core/constants";

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
    [SquareType.CentralPark, "central-park"], [SquareType.Utility, "utility"], [SquareType.Lotto, "lotto"]
  ]);

  const getContainerClassName = () => {
    return "container container-" + sectionMap.get(section);
  };


  const getSquareClassName = () => {
    const css = "square " + squareTypeClass.get(squareType);
    if (isMortgaged()) {
      return css + " mortgaged";
    }
    return css;
  };

  const getSquareId = () => {
    return "game-square-" + id;
  };

  const setSquareToView = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    viewSquare(id);
  };
  const setSquareToView2 = (event: TouchEvent<HTMLDivElement>) => {
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

  const isOwned = (): boolean => {
    const data = getSquareGameData();
    return data && data.owner ? true : false;
  };

  const getOwnedStyle = (): React.CSSProperties => {
    if (isOwned() && gameInfo) {
      const data = getSquareGameData();
      if (data) {
        const owner = gameInfo.players.find((p) => areObjectIdsEqual(p._id, data.owner));
        if (owner) {
          const fromColor = player_colors_to_rgb.get(owner.color);
          return { background: "linear-gradient(to bottom, " + fromColor + ", rgba(255, 0, 0, 0))" };
        }

      }
    }
    return {};
  };

  return (
    <React.Fragment>
      <div className={getSquareClassName()} style={getOwnedStyle()} id={getSquareId()} onTouchStart={setSquareToView2} onClick={setSquareToView} onMouseEnter={setSquareToView} onMouseLeave={leaveSquare}>

        <div className={getContainerClassName()}>
          <SquareInfo id={id} gameInfo={gameInfo} />

        </div>
      </div>
    </React.Fragment>

  );


};
