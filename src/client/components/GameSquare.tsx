import React, { TouchEvent } from "react";
import { BoardSection } from "../../core/enums/BoardSection";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { SquareInfo } from "./SquareInfo";
import { SquareType } from "../../core/enums/SquareType";
import { GameState } from "../../core/types/GameState";
import { SquareGameData } from "../../core/types/SquareGameData";
import { areObjectIdsEqual, getGameContextFromLocalStorage, getMyUserId, handleApiError } from "../helpers";
import { player_colors_to_rgb } from "../../core/constants";
import { ActionMode } from "../../core/enums/ActionMode";
import API from '../api';
import { GameContext } from "../../core/types/GameContext";
import { GameEvent } from "../../core/types/GameEvent";
import { SocketService } from "../sockets/SocketService";

interface Props {
  id: number;
  gameInfo: GameState | undefined;
  viewSquare: (id: number) => void;
  clearSquare: () => void;
  actionMode: ActionMode;
  socketService?: SocketService;
}

export const GameSquare: React.FC<Props> = ({ id, gameInfo, viewSquare, clearSquare, actionMode, socketService }) => {

  const context: GameContext = getGameContextFromLocalStorage();
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

  const getMyName = (): string => {
    const player = gameInfo && gameInfo.players.find((p) => areObjectIdsEqual(p._id, getMyUserId()));
    if (player) {
      return player.name;
    }
    return "";
  };

  const getSquareTxt = () => {
    const squareId = getSquareId();
    if (gameInfo && gameInfo.theme && squareId) {
      return gameInfo.theme[id].name;
    }
    return "";
  }

  const onMortgageProperty = async () => {
    API.post("actions/mortgage", { squareId: id, context })
      .then(function (response) {
        if (socketService && gameInfo) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameInfo._id);
          socketService.socket.emit(GameEvent.SHOW_SNACK_MSG, gameInfo._id, getMyName() + " mortaged " + getSquareTxt());
        }
      })
      .catch(handleApiError);
  };

  const onRedeemProperty = async () => {
    API.post("actions/redeem", { squareId: id, context })
      .then(function (response) {
        if (socketService && gameInfo) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameInfo._id);
          socketService.socket.emit(GameEvent.SHOW_SNACK_MSG, gameInfo._id, getMyName() + " redeemed " + getSquareTxt());
        }
      })
      .catch(handleApiError);
  };


  const onBuildHouse = async () => {
    API.post("actions/buildHouse", { squareId: id, context })
      .then(function (response) {
        if (socketService && gameInfo) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameInfo._id);
          socketService.socket.emit(GameEvent.SHOW_SNACK_MSG, gameInfo._id, getMyName() + " built house on " + getSquareTxt());
        }
      })
      .catch(handleApiError);
  };

  const onSellHouse = async () => {
    API.post("actions/sellHouse", { squareId: id, context })
      .then(function (response) {
        if (socketService && gameInfo) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameInfo._id);
          socketService.socket.emit(GameEvent.SHOW_SNACK_MSG, gameInfo._id, getMyName() + " sold house on " + getSquareTxt());
        }
      })
      .catch(handleApiError);
  };

  const isOwnedByMe = (): boolean => {
    const data = getSquareGameData();
    if (data && gameInfo && data.owner && areObjectIdsEqual(getMyUserId(), data.owner)) {
      return true;
    }
    return false;
  };

  const isMyTurn = () => {
    const uid = getMyUserId();
    return uid && gameInfo && gameInfo.nextPlayerToAct && areObjectIdsEqual(uid, gameInfo.nextPlayerToAct) && gameInfo.auctionId == null;
  }


  const clickOnSquare = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    processClickAction();
  };

  const setSquareToView2 = (event: TouchEvent<HTMLDivElement>) => {
    processClickAction();
  };

  const processClickAction = () => {
    const config = SquareConfigDataMap.get(id);
    const showMortgageRedeemOptions = config && (config.type === SquareType.Property || config.type === SquareType.TrainStation);
    const showBuildingOptions = config && config.type === SquareType.Property;
    const canAct = isOwnedByMe() && isMyTurn();

    if (actionMode === ActionMode.Mortgage && canAct && showMortgageRedeemOptions && !isMortgaged()) {
      onMortgageProperty();
    } else if (actionMode === ActionMode.Redeem && canAct && showMortgageRedeemOptions && isMortgaged()) {
      onRedeemProperty();
    } else if (actionMode === ActionMode.Build && canAct && showBuildingOptions) {
      onBuildHouse();
    } else if (actionMode === ActionMode.Sell && canAct && showBuildingOptions) {
      onSellHouse();
    } else {
      viewSquare(id);
    }
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
      <div className={getSquareClassName()} style={getOwnedStyle()} id={getSquareId()} onTouchStart={setSquareToView2} onClick={clickOnSquare} onMouseEnter={setSquareToView} onMouseLeave={leaveSquare}>

        <div className={getContainerClassName()}>
          <SquareInfo id={id} gameInfo={gameInfo} />

        </div>
      </div>
    </React.Fragment>

  );


};
