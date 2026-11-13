import React, { TouchEvent } from "react";
import { BoardSection } from "../../core/enums/BoardSection";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { SquareInfo } from "./SquareInfo";
import { SquareType } from "../../core/enums/SquareType";
import { SquareGameData } from "../../core/types/SquareGameData";
import { areObjectIdsEqual, getGameContextFromLocalStorage, getIconProp, getMyUserId, handleApiError } from "../helpers";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Player } from "../../core/types/Player";
import { ActionMode } from "../../core/enums/ActionMode";
import API from '../api';
import { GameContext } from "../../core/types/GameContext";
import { GameEvent } from "../../core/types/GameEvent";
import { SocketService } from "../sockets/SocketService";
import useGameStateStore from "../stores/gameStateStore";

interface Props {
  id: number;
  viewSquare: (id: number) => void;
  socketService?: SocketService;
}

export const GameSquare: React.FC<Props> = ({ id, viewSquare, socketService }) => {

  const context: GameContext = getGameContextFromLocalStorage();
  const section: BoardSection = SquareConfigDataMap.get(id)?.section!;
  const squareType: SquareType = SquareConfigDataMap.get(id)?.type!;

  const gameState = useGameStateStore(state => state.data);
  const actionMode = useGameStateStore(state => state.actionMode);
  const infoFocus = useGameStateStore(state => state.infoFocus);
  const playerToView = useGameStateStore(state => state.playerToView);
  const spotlightPlayerId = infoFocus === "player" ? playerToView : undefined;

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
    const owner = getOwner();
    const classes = ["square", squareTypeClass.get(squareType) ?? ""];
    if (isMortgaged()) {
      classes.push("mortgaged");
    }
    if (owner) {
      classes.push("owned", "owned-" + sectionMap.get(section));
    }
    // a player is being pointed at in the player list: light up what they own
    if (spotlightPlayerId) {
      classes.push(owner && areObjectIdsEqual(owner._id, spotlightPlayerId) ? "spotlit" : "dimmed");
    }
    return classes.join(" ");
  };

  const getSquareId = () => {
    return "game-square-" + id;
  };

  const getMyName = (): string => {
    const player = gameState && gameState.players.find((p) => areObjectIdsEqual(p._id, getMyUserId()));
    if (player) {
      return player.name;
    }
    return "";
  };

  const getSquareTxt = () => {
    const squareId = getSquareId();
    if (gameState && gameState.theme && squareId) {
      return gameState.theme[id].name;
    }
    return "";
  }

  const onMortgageProperty = async () => {
    API.post("actions/mortgage", { squareId: id, context })
      .then(function (response) {
        if (socketService && gameState) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameState._id);
          socketService.socket.emit(GameEvent.SHOW_SNACK_MSG, gameState._id, getMyName() + " mortaged " + getSquareTxt());
        }
      })
      .catch(handleApiError);
  };

  const onRedeemProperty = async () => {
    API.post("actions/redeem", { squareId: id, context })
      .then(function (response) {
        if (socketService && gameState) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameState._id);
          socketService.socket.emit(GameEvent.SHOW_SNACK_MSG, gameState._id, getMyName() + " redeemed " + getSquareTxt());
        }
      })
      .catch(handleApiError);
  };


  const onBuildHouse = async () => {
    API.post("actions/buildHouse", { squareId: id, context })
      .then(function (response) {
        if (socketService && gameState) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameState._id);
          socketService.socket.emit(GameEvent.SHOW_SNACK_MSG, gameState._id, getMyName() + " built house on " + getSquareTxt());
        }
      })
      .catch(handleApiError);
  };

  const onSellHouse = async () => {
    API.post("actions/sellHouse", { squareId: id, context })
      .then(function (response) {
        if (socketService && gameState) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameState._id);
          socketService.socket.emit(GameEvent.SHOW_SNACK_MSG, gameState._id, getMyName() + " sold house on " + getSquareTxt());
        }
      })
      .catch(handleApiError);
  };

  const isOwnedByMe = (): boolean => {
    const data = getSquareGameData();
    if (data && gameState && data.owner && areObjectIdsEqual(getMyUserId(), data.owner)) {
      return true;
    }
    return false;
  };

  const isMyTurn = () => {
    const uid = getMyUserId();
    return uid && gameState && gameState.nextPlayerToAct && areObjectIdsEqual(uid, gameState.nextPlayerToAct) && gameState.auctionId == null;
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


  const getSquareGameData = (): SquareGameData | undefined => {
    if (gameState && gameState.squareState) {
      return gameState.squareState.find((p: SquareGameData) => p.squareId === id);
    }
    return undefined;
  };

  const isMortgaged = (): boolean => {
    const data = getSquareGameData();
    return data && data.isMortgaged ? true : false;
  };


  const getOwner = (): Player | undefined => {
    const data = getSquareGameData();
    if (!data?.owner || !gameState) {
      return undefined;
    }
    return gameState.players.find((p) => areObjectIdsEqual(p._id, data.owner));
  };

  const owner = getOwner();
  // the owner's colour drives the stripe on the square's outer edge (board.css)
  const ownedStyle = owner ? ({ "--owner": owner.color } as React.CSSProperties) : undefined;

  return (
    <React.Fragment>
      <div className={getSquareClassName()} style={ownedStyle} id={getSquareId()} onTouchStart={setSquareToView2} onClick={clickOnSquare} onMouseEnter={setSquareToView}>

        <div className={getContainerClassName()}>
          <SquareInfo id={id} />

        </div>

        {owner &&
          <span className="owner-badge" style={{ background: owner.color }} title={"Owned by " + owner.name}>
            <FontAwesomeIcon icon={getIconProp(owner.type)} />
          </span>}
      </div>
    </React.Fragment>

  );


};
