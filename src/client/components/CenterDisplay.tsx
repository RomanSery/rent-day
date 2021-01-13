import React, { useState } from "react";
import { DisplayPlayers } from "./DisplayPlayers";
import { GameState } from "../../core/types/GameState";
import { DisplayActions } from "./DisplayActions";
import { SocketService } from "../sockets/SocketService";
import { DisplayResults } from "./DisplayResults";
import { PlayerViewer } from "./PlayerViewer";
import API from '../api';
import { GameContext } from "../../core/types/GameContext";
import { GameEvent } from "../../core/types/GameEvent";
import { areObjectIdsEqual, getGameContextFromLocalStorage, getMyGameId, getMyUserId, handleApiError } from "../helpers";
import { SquareViewer } from "./SquareViewer";
import { Player } from "../../core/types/Player";
import { DisplayAuction } from "./DisplayAuction";
import { DisplayTreasure } from "./DisplayTreasure";

interface Props {
  gameInfo: GameState | undefined;
  socketService: SocketService;
  getPing: (userId: string | undefined) => string;
  getSquareId: () => number | undefined;
}

export const CenterDisplay: React.FC<Props> = ({ gameInfo, socketService, getPing, getSquareId }) => {

  const context: GameContext = getGameContextFromLocalStorage();

  const [playerToView, setPlayerToView] = useState<Player | undefined>(undefined);

  const onRollDice = async () => {
    if (socketService) {
      socketService.socket.emit(GameEvent.ROLL_DICE, getMyGameId());
    }

    setTimeout(() => {
      API.post("actions/roll", { context })
        .then(function (response) {
          if (socketService) {
            socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, getMyGameId());
          }
        })
        .catch(handleApiError);
    }, 1200);

  };

  const viewPlayer = (player: Player) => {
    setPlayerToView(player);
  };
  const clearPlayer = () => {
    if (gameInfo && gameInfo.players) {
      const myUserId = getMyUserId();
      if (myUserId) {
        const myPlayer = gameInfo.players.find((p: Player) => areObjectIdsEqual(p._id, myUserId));
        setPlayerToView(myPlayer);
      }

    } else {
      setPlayerToView(undefined);
    }
  };

  const getPlayerToView = (): Player | undefined => {
    if (playerToView) {
      return playerToView;
    }
    if (gameInfo && gameInfo.players) {
      const myUserId = getMyUserId();
      if (myUserId) {
        return gameInfo.players.find((p) => areObjectIdsEqual(p._id, myUserId));
      }
      return undefined;
    }
    return playerToView;
  }

  const getGameResultsDisplayComp = () => {
    if (gameInfo?.auctionId) {
      return (<DisplayAuction gameInfo={gameInfo} socketService={socketService} />);
    }
    if (gameInfo?.treasureId) {
      return (<DisplayTreasure gameInfo={gameInfo} socketService={socketService} />);
    }
    return (<DisplayResults gameInfo={gameInfo} socketService={socketService} />);
  }

  return (
    <React.Fragment>
      <div className="center-square square">
        <div className="center-left-side">
          <div className="game-results">
            {getGameResultsDisplayComp()}
          </div>

          <div className="second-row">
            <div className="player-viewer">
              <PlayerViewer gameInfo={gameInfo} getPlayer={getPlayerToView} />
            </div>
            <div className="property-viewer">
              <SquareViewer gameInfo={gameInfo} getSquareId={getSquareId} socketService={socketService} />
            </div>

          </div>

          <div className="player-actions">
            <DisplayActions gameInfo={gameInfo} onRollAction={onRollDice} socketService={socketService} />
          </div>

        </div>

        <DisplayPlayers gameInfo={gameInfo} getPing={getPing} viewPlayer={viewPlayer} clearPlayer={clearPlayer} />

      </div>
    </React.Fragment>
  );

};
