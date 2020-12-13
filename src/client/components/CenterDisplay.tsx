import React from "react";
import { DisplayPlayers } from "./DisplayPlayers";
import { GameState } from "../../core/types/GameState";
import { DisplayActions } from "./DisplayActions";
import { SocketService } from "../sockets/SocketService";
import { DisplayResults } from "./DisplayResults";
import { DisplayMyInfo } from "./DisplayMyInfo";
import API from '../api';
import { GameContext } from "../../core/types/GameContext";
import { GameEvent } from "../../core/types/GameEvent";
import { getGameContextFromLocalStorage, getMyGameId } from "../helpers";

interface Props {
  gameInfo: GameState | undefined;
  socketService: SocketService;
  getPing: (playerId: string | undefined) => string;
}

export const CenterDisplay: React.FC<Props> = ({ gameInfo, socketService, getPing }) => {

  const context: GameContext = getGameContextFromLocalStorage();

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


  return (
    <React.Fragment>
      <div className="center-square square">
        <div className="center-left-side">
          <DisplayResults gameInfo={gameInfo} socketService={socketService} />
          <DisplayMyInfo gameInfo={gameInfo} socketService={socketService} />
          <DisplayActions gameInfo={gameInfo} socketService={socketService} onRollAction={onRollDice} />
        </div>

        <DisplayPlayers gameInfo={gameInfo} getPing={getPing} />

      </div>
    </React.Fragment>
  );

};
