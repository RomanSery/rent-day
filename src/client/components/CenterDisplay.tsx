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
import { getGameContextFromLocalStorage, getMyGameId, getMyPlayerId } from "../helpers";
import { SquareViewer } from "./SquareViewer";
import { Player } from "../../core/types/Player";
import { DisplayAuction } from "./DisplayAuction";

interface Props {
  gameInfo: GameState | undefined;
  socketService: SocketService;
  getPing: (playerId: string | undefined) => string;
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
        .catch(function (error) {
          if (error.response) {
            alert(error.response.data);
          } else if (error.request) {
            console.log(error.request);
          } else {
            console.log('Error', error.message);
          }
        });
    }, 1200);

  };

  const viewPlayer = (player: Player) => {
    setPlayerToView(player);
  };
  const clearPlayer = () => {
    if (gameInfo && gameInfo.players) {
      const myPlayerId = getMyPlayerId();
      const myPlayer = gameInfo.players.find(
        (p) => p._id && p._id.toString() === myPlayerId
      );
      setPlayerToView(myPlayer);
    } else {
      setPlayerToView(undefined);
    }
  };

  const getPlayerToView = (): Player | undefined => {
    if (playerToView) {
      return playerToView;
    }
    if (gameInfo && gameInfo.players) {
      const myPlayerId = getMyPlayerId();
      const myPlayer = gameInfo.players.find(
        (p) => p._id && p._id.toString() === myPlayerId
      );
      return myPlayer;
    }
    return playerToView;
  }

  const getGameResultsDisplayComp = () => {
    if (gameInfo?.auctionId) {
      return (<DisplayAuction gameInfo={gameInfo} socketService={socketService} />);
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
              <SquareViewer gameInfo={gameInfo} getSquareId={getSquareId} />
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
