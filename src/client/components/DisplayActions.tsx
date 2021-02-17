/* eslint-disable react-hooks/exhaustive-deps */
import React from "react";
import { Button } from "@material-ui/core";
import { areObjectIdsEqual, getGameContextFromLocalStorage, getMyUserId, handleApiError, leaveCurrentGameIfJoined } from "../helpers";
import { GameState } from "../../core/types/GameState";
import { useHistory } from "react-router-dom";
import API from '../api';
import { GameContext } from "../../core/types/GameContext";
import { GameEvent } from "../../core/types/GameEvent";
import { SocketService } from "../sockets/SocketService";
import { Player } from "../../core/types/Player";
import { PlayerState } from "../../core/enums/PlayerState";
import { faDice, faTimesCircle, faCheckCircle, faChartBar, faTrain } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { StatsDialog } from "../dialogs/StatsDialog";


interface Props {
  gameInfo: GameState | undefined;
  socketService: SocketService;
  tradeWithPlayer: (player: Player) => void;
  onRollAction: () => void;
  onTravelAction: () => void;
}

export const DisplayActions: React.FC<Props> = ({ gameInfo, socketService, onRollAction, onTravelAction, tradeWithPlayer }) => {

  const context: GameContext = getGameContextFromLocalStorage();
  const history = useHistory();
  const [statsViewOpen, setStatsViewOpen] = React.useState(false);
  const [rollBtnHidden, setRollBtnHidden] = React.useState(false);


  const getMyPlayer = (): Player | undefined => {
    if (gameInfo) {
      return gameInfo.players.find((p: Player) => areObjectIdsEqual(p._id, getMyUserId()));
    }
    return undefined;
  }

  React.useEffect(() => {
    socketService.listenForEvent(GameEvent.UPDATE_GAME_STATE, (data: any) => {
      setRollBtnHidden(false);
    });
  }, []);

  const onClickRoll = async () => {
    setRollBtnHidden(true);
    onRollAction();
  };

  const onClickTravel = async () => {
    onTravelAction();
  };

  const onClickDone = async () => {
    API.post("actions/completeTurn", { context })
      .then(function (response) {
        if (socketService && gameInfo) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameInfo._id);
        }
      })
      .catch(handleApiError);
  };

  const onGetOut = async () => {
    API.post("actions/getOut", { context })
      .then(function (response) {
        if (socketService && gameInfo) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameInfo._id);
        }
      })
      .catch(handleApiError);
  };

  const getMyName = (): string => {
    const player = gameInfo && gameInfo.players.find((p) => areObjectIdsEqual(p._id, getMyUserId()));
    if (player) {
      return player.name;
    }
    return "";
  };

  const onLeaveGame = async () => {
    leaveCurrentGameIfJoined(() => {
      if (gameInfo) {
        socketService.socket.emit(GameEvent.SHOW_SNACK_MSG, gameInfo._id, getMyName() + " has quit");
      }
      history.push("/dashboard");
    });
  };

  const isMyTurn = () => {
    const uid = getMyUserId();
    return uid && gameInfo && gameInfo.nextPlayerToAct && areObjectIdsEqual(uid, gameInfo.nextPlayerToAct) && gameInfo.auctionId == null;
  }

  const canCompleteTurn = (): boolean => {
    const p = getMyPlayer();
    if (!p) {
      return false;
    }
    if (!p.hasRolled) {
      return false;
    }
    if (p.money < 0) {
      return false;
    }
    if (gameInfo && gameInfo.lottoId) {
      return false;
    }
    return true;
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
      if (myPlayer.money < 0) {
        return false;
      }
      return true;
    }

    return false;
  }

  const canTravel = (): boolean => {
    const myPlayer = getMyPlayer();
    if (myPlayer != null && myPlayer !== undefined) {
      if (myPlayer.hasRolled) {
        return false;
      }
      if (myPlayer.state === PlayerState.BANKRUPT) {
        return false;
      }
      if (myPlayer.money < 0) {
        return false;
      }
      return myPlayer.canTravel && !myPlayer.hasTraveled;
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



  const onViewStats = async () => {
    setStatsViewOpen(true);
  };

  const getMyActions = () => {
    if (isMyTurn()) {
      return (
        <React.Fragment>
          {canRoll() && !rollBtnHidden ?
            <Button variant="contained" color="primary" onClick={onClickRoll}
              startIcon={<FontAwesomeIcon icon={faDice} />}>Roll</Button>
            : null}

          {canTravel() ?
            <Button variant="contained" color="primary" onClick={onClickTravel}
              startIcon={<FontAwesomeIcon icon={faTrain} />}>Travel</Button>
            : null}

          {canPayToGetOutOfIsolation() ?
            <Button variant="contained" color="primary" onClick={onGetOut}>Pay To Get Out</Button>
            : null}

          {canCompleteTurn() ?
            <Button variant="contained" color="primary" onClick={onClickDone} startIcon={<FontAwesomeIcon icon={faCheckCircle} />}>Done</Button>
            : null}

          <Button variant="contained" color="primary" startIcon={<FontAwesomeIcon icon={faChartBar} />} onClick={onViewStats}>Stats</Button>
          <Button variant="contained" color="secondary" startIcon={<FontAwesomeIcon icon={faTimesCircle} />}
            onClick={() => { if (window.confirm('Are you sure you wish to quit the game?')) { onLeaveGame(); } }}>Give Up</Button>
        </React.Fragment>
      );
    }

    return (
      <React.Fragment>
        <Button variant="contained" color="primary" startIcon={<FontAwesomeIcon icon={faChartBar} />} onClick={onViewStats}>Stats</Button>
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      {getMyActions()}

      <StatsDialog tradeWithPlayer={tradeWithPlayer} gameInfo={gameInfo}
        open={statsViewOpen} onClose={() => setStatsViewOpen(false)}
      />
    </React.Fragment>
  );

};
