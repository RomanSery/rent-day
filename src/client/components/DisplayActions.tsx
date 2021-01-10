import React from "react";
import { Button, ButtonGroup, Container } from "@material-ui/core";
import { areObjectIdsEqual, getGameContextFromLocalStorage, getMyGameId, getMyUserId, handleApiError, leaveCurrentGameIfJoined } from "../helpers";
import { GameState } from "../../core/types/GameState";
import { useHistory } from "react-router-dom";
import API from '../api';
import { GameContext } from "../../core/types/GameContext";
import { GameEvent } from "../../core/types/GameEvent";
import { SocketService } from "../sockets/SocketService";
import { Player } from "../../core/types/Player";

interface Props {
  gameInfo: GameState | undefined;
  socketService: SocketService;
  onRollAction: () => void;
}

export const DisplayActions: React.FC<Props> = ({ gameInfo, socketService, onRollAction }) => {

  const context: GameContext = getGameContextFromLocalStorage();
  const history = useHistory();

  const onClickRoll = async () => {
    onRollAction();
  };

  const onClickDone = async () => {
    API.post("actions/completeTurn", { context })
      .then(function (response) {
        if (socketService) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, getMyGameId());
        }
      })
      .catch(handleApiError);
  };

  const onLeaveGame = async () => {
    leaveCurrentGameIfJoined(() => {
      history.push("/");
    });
  };

  const isMyTurn = () => {
    const uid = getMyUserId();
    return uid && gameInfo && gameInfo.nextPlayerToAct && areObjectIdsEqual(uid, gameInfo.nextPlayerToAct) && gameInfo.auctionId == null;
  }

  const hasAlreadyRolled = (): boolean => {
    if (gameInfo) {
      const myPlayer = gameInfo.players.find((p: Player) => areObjectIdsEqual(p._id, context.userId));
      if (myPlayer && myPlayer.hasRolled) {
        return true;
      }
      return false;
    }

    return true;
  }

  const getMyActions = () => {
    return (
      <Container maxWidth="sm">
        <ButtonGroup variant="contained" color="primary" aria-label="contained primary button group">
          {!hasAlreadyRolled() ? <Button color="primary" size="small" onClick={onClickRoll}>Roll dice</Button> : null}
          {hasAlreadyRolled() ? <Button color="primary" size="small" onClick={onClickDone}>Done</Button> : null}
          <Button color="secondary" onClick={onLeaveGame} size="small"> Leave Game</Button>
        </ButtonGroup>
      </Container>
    );
  }



  return (
    <React.Fragment>
      {isMyTurn() ? getMyActions() : null}
    </React.Fragment>
  );

};
