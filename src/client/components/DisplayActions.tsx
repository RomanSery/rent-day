import React from "react";
import API from '../api';
import { Button, ButtonGroup } from "@material-ui/core";
import { getGameContextFromLocalStorage, getMyGameId, getMyPlayerId, leaveCurrentGameIfJoined } from "../helpers";
import { GameState } from "../../core/types/GameState";
import { GameContext } from "../../core/types/GameContext";
import { useHistory } from "react-router-dom";
import { SocketService } from "../sockets/SocketService";
import { GameEvent } from "../../core/types/GameEvent";

interface Props {
  gameInfo: GameState | undefined;
  socketService: SocketService;
}

export const DisplayActions: React.FC<Props> = ({ gameInfo, socketService }) => {

  const context: GameContext = getGameContextFromLocalStorage();
  const history = useHistory();

  const onRollDice = async () => {
    API.post("actions/roll", { context })
      .then(function (response) {
        if (socketService) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, getMyGameId());
        }
      })
      .catch(function (error) {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          alert(error.response.data);
        } else if (error.request) {
          // The request was made but no response was received
          // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
          // http.ClientRequest in node.js
          console.log(error.request);
        } else {
          // Something happened in setting up the request that triggered an Error
          console.log('Error', error.message);
        }
      });
  };

  const onLeaveGame = async () => {
    leaveCurrentGameIfJoined(() => {
      history.push("/");
    });
  };

  const isMyTurn = () => {
    return getMyPlayerId() == gameInfo?.nextPlayerToAct;
  }

  const getMyActions = () => {
    return (
      <React.Fragment>

        <ButtonGroup variant="contained" color="primary" aria-label="contained primary button group">
          <Button color="primary" onClick={onRollDice}>Roll dice</Button>
          <Button color="primary">Build</Button>
          <Button color="primary">Mortgage</Button>
          <Button color="primary">Redeem</Button>
          <Button color="primary">Sell</Button>
          <Button color="secondary" onClick={onLeaveGame}> Leave Game</Button>
        </ButtonGroup>

      </React.Fragment>
    );
  }



  return (
    <React.Fragment>
      <div className="player-actions">
        {isMyTurn() && getMyActions()}
      </div>
    </React.Fragment>
  );

};
