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
import { getGameContextFromLocalStorage, getMyGameId } from "../helpers";
import { SquareViewer } from "./SquareViewer";
import { Player } from "../../core/types/Player";

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
    setPlayerToView(undefined);
  };


  return (
    <React.Fragment>
      <div className="center-square square">
        <div className="center-left-side">
          <div className="game-results">
            <DisplayResults gameInfo={gameInfo} socketService={socketService} />
          </div>

          <div className="second-row">
            <div className="player-viewer">
              <PlayerViewer gameInfo={gameInfo} getPlayer={() => playerToView} />
            </div>
            <div className="property-viewer">
              <SquareViewer gameInfo={gameInfo} getSquareId={getSquareId} />
            </div>

          </div>

          <div className="player-actions">
            <DisplayActions gameInfo={gameInfo} socketService={socketService} onRollAction={onRollDice} />
          </div>

        </div>

        <DisplayPlayers gameInfo={gameInfo} getPing={getPing} viewPlayer={viewPlayer} clearPlayer={clearPlayer} />

      </div>
    </React.Fragment>
  );

};
