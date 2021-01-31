import React from "react";
import { Button } from "@material-ui/core";
import { areObjectIdsEqual, getGameContextFromLocalStorage, getMyGameId, getMyUserId, handleApiError, leaveCurrentGameIfJoined } from "../helpers";
import { GameState } from "../../core/types/GameState";
import { useHistory } from "react-router-dom";
import API from '../api';
import { GameContext } from "../../core/types/GameContext";
import { GameEvent } from "../../core/types/GameEvent";
import { SocketService } from "../sockets/SocketService";
import { Player } from "../../core/types/Player";
import { PlayerState } from "../../core/enums/PlayerState";
import { faDice, faTimesCircle, faCheckCircle, faChartBar } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { StatsDialog } from "../dialogs/StatsDialog";


interface Props {
  gameInfo: GameState | undefined;
  socketService: SocketService;
  onRollAction: () => void;
}

export const DisplayActions: React.FC<Props> = ({ gameInfo, socketService, onRollAction }) => {

  const context: GameContext = getGameContextFromLocalStorage();
  const history = useHistory();
  const [statsViewOpen, setStatsViewOpen] = React.useState(false);

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

  const onGetOut = async () => {
    API.post("actions/getOut", { context })
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
    const myPlayer = getMyPlayer();
    return myPlayer && myPlayer.hasRolled ? true : false;
  }

  const canRoll = (): boolean => {
    const myPlayer = getMyPlayer();
    if (myPlayer != null && myPlayer !== undefined) {
      if (myPlayer.hasRolled) {
        return false;
      }
      if (myPlayer.state === PlayerState.BANKRUPT) {
        return false;
      }
      return true;
    }

    return false;
  }

  const canPayToGetOutOfIsolation = (): boolean => {
    const myPlayer = getMyPlayer();
    if (myPlayer != null && myPlayer !== undefined) {
      return !myPlayer.hasRolled && myPlayer.state === PlayerState.IN_ISOLATION ? true : false;
    }

    return false;
  }

  const getMyPlayer = (): Player | undefined => {
    if (gameInfo) {
      return gameInfo.players.find((p: Player) => areObjectIdsEqual(p._id, context.userId));
    }
    return undefined;
  }

  const onViewStats = async () => {
    setStatsViewOpen(true);
  };

  const getMyActions = () => {
    return (
      <React.Fragment>
        {canRoll() ?
          <div><Button variant="contained" color="primary" onClick={onClickRoll} startIcon={<FontAwesomeIcon icon={faDice} />}>Roll</Button></div>
          : null}

        {canPayToGetOutOfIsolation() ?
          <Button variant="contained" color="primary" onClick={onGetOut}>Pay To Get Out</Button>
          : null}

        {hasAlreadyRolled() ?
          <Button variant="contained" color="primary" onClick={onClickDone} startIcon={<FontAwesomeIcon icon={faCheckCircle} />}>Done</Button>
          : null}

        <Button variant="contained" color="primary" startIcon={<FontAwesomeIcon icon={faChartBar} />} onClick={onViewStats}>Stats</Button>


        <Button variant="contained" color="secondary" startIcon={<FontAwesomeIcon icon={faTimesCircle} />} onClick={onLeaveGame}>Quit</Button>


      </React.Fragment>
    );
  }



  return (
    <React.Fragment>
      {isMyTurn() ? getMyActions() : null}

      <StatsDialog socketService={socketService} gameInfo={gameInfo}
        open={statsViewOpen} onClose={() => setStatsViewOpen(false)}
      />
    </React.Fragment>
  );

};
