/* eslint-disable react-hooks/exhaustive-deps */
import React from "react";
import { Button, Menu, MenuItem } from "@material-ui/core";
import { areObjectIdsEqual, getGameContextFromLocalStorage, getMyUserId, handleApiError, leaveCurrentGameIfJoined, resignCurrGame } from "../helpers";
import { useHistory } from "react-router-dom";
import API from '../api';
import { GameContext } from "../../core/types/GameContext";
import { GameEvent } from "../../core/types/GameEvent";
import { SocketService } from "../sockets/SocketService";
import { Player } from "../../core/types/Player";
import { PlayerState } from "../../core/enums/PlayerState";
import { faDice, faCheckCircle, faTrain, faCaretDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { StatsDialog } from "../dialogs/StatsDialog";
import { MyTaxesDialog } from "../dialogs/MyTaxesDialog";
import { motion } from "framer-motion";
import { HelpDialog } from "../dialogs/HelpDialog";
import { ActionMode } from "../../core/enums/ActionMode";
import useGameStateStore from "../stores/gameStateStore";


interface Props {
  socketService: SocketService;
  tradeWithPlayer: (player: Player) => void;
  onRollAction: () => void;
  onTravelAction: () => void;
}

export const DisplayActions: React.FC<Props> = ({ socketService, onRollAction, onTravelAction, tradeWithPlayer }) => {

  const context: GameContext = getGameContextFromLocalStorage();
  const history = useHistory();

  const [rollBtnHidden, setRollBtnHidden] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const gameState = useGameStateStore(state => state.data);
  const actionMode = useGameStateStore(state => state.actionMode);
  const setActionMode = useGameStateStore(state => state.setActionMode);
  const setStatsViewOpen = useGameStateStore(state => state.setStatsViewOpen);
  const setTaxesViewOpen = useGameStateStore(state => state.setTaxesViewOpen);
  const setHelpOpen = useGameStateStore(state => state.setHelpOpen);


  const getMyPlayer = (): Player | undefined => {
    if (gameState) {
      return gameState.players.find((p: Player) => areObjectIdsEqual(p._id, getMyUserId()));
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
        if (socketService && gameState) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameState._id, true);
        }
      })
      .catch(handleApiError);
  };

  const onGetOut = async () => {
    API.post("actions/getOut", { context })
      .then(function (response) {
        if (socketService && gameState) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameState._id);
        }
      })
      .catch(handleApiError);
  };

  const getMyName = (): string => {
    const player = gameState && gameState.players.find((p) => areObjectIdsEqual(p._id, getMyUserId()));
    if (player) {
      return player.name;
    }
    return "";
  };

  const onLeaveGame = async () => {
    leaveCurrentGameIfJoined(socketService, () => {
      if (gameState) {
        socketService.socket.emit(GameEvent.SHOW_SNACK_MSG, gameState._id, getMyName() + " has quit");
      }
      history.push("/dashboard");
    });
  };

  const onResign = async () => {
    resignCurrGame(socketService, () => {
      if (gameState) {
        socketService.socket.emit(GameEvent.SHOW_SNACK_MSG, gameState._id, getMyName() + " has resigned");
      }      
    });
  };

  const isMyTurn = () => {
    const uid = getMyUserId();
    return uid && gameState && gameState.nextPlayerToAct && areObjectIdsEqual(uid, gameState.nextPlayerToAct) && gameState.auctionId == null;
  }


  const stillActivePlayer = () => {
    const myPlayer = getMyPlayer();
    if (!myPlayer) {
      return false;
    }
    if (myPlayer.state !== PlayerState.BANKRUPT) {
      return true;
    }
    return false;
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
    if (gameState && gameState.lottoId) {
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
      if (gameState && gameState.lottoId) {
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
    setAnchorEl(null);
  };

  const onViewTaxes = async () => {
    setTaxesViewOpen(true);
    setAnchorEl(null);
  };

  const onViewHelp = async () => {
    setHelpOpen(true);
    setAnchorEl(null);
  };

  const getRollBtn = () => {
    if (canRoll() && !rollBtnHidden) {
      return (
        <motion.div animate={{ scale: 1.1 }} transition={{
          duration: 1.0,
          loop: Infinity,
          repeatDelay: 0
        }}>
          <Button variant="contained" color="primary" onClick={onClickRoll}
            startIcon={<FontAwesomeIcon icon={faDice} />}>Roll</Button>
        </motion.div>
      );
    }
    return null;
  };

  const getCompleteTurnBtn = () => {
    if (canCompleteTurn()) {
      return (
        <motion.div animate={{ scale: 1.1 }} transition={{
          duration: 1.0,
          loop: Infinity,
          repeatDelay: 0
        }}>
          <Button variant="contained" color="primary" onClick={onClickDone} startIcon={<FontAwesomeIcon icon={faCheckCircle} />}>Done</Button>
        </motion.div>
      );
    }
    return null;
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const onSetActionMode = (mode: ActionMode) => {
    setActionMode(mode);
    setAnchorEl(null);
  };

  const onFinishAction = () => {
    setActionMode(ActionMode.None);
  };

  const getActionDescription = () => {
    if (actionMode === ActionMode.Mortgage) {
      return "Click on a property to mortgage it. When done click here";
    } else if (actionMode === ActionMode.Redeem) {
      return "Click on a property to redeem it. When done click here";
    } else if (actionMode === ActionMode.Build) {
      return "Click on a property to build houses on. When done click here";
    } else if (actionMode === ActionMode.Sell) {
      return "Click on a property to sell houses. When done click here";
    }
  }


  const getMyActions = () => {
    const myTurn = isMyTurn();

    if (actionMode !== ActionMode.None) {
      return (
        <Button variant="contained" color="primary" onClick={onFinishAction}>{getActionDescription()}</Button>
      );
    }


    return (
      <React.Fragment>
        {myTurn ? getRollBtn() : null}

        {myTurn && canTravel() ?
          <Button variant="contained" color="primary" onClick={onClickTravel}
            startIcon={<FontAwesomeIcon icon={faTrain} />}>Travel</Button>
          : null}

        {myTurn && canPayToGetOutOfIsolation() ?
          <Button variant="contained" color="primary" onClick={onGetOut}>Pay To Get Out</Button>
          : null}

        {myTurn ? getCompleteTurnBtn() : null}

        <Button startIcon={<FontAwesomeIcon icon={faCaretDown} />} variant="contained" color="primary" aria-controls="my-action-menu" aria-haspopup="true" onClick={handleClick}>Actions</Button>
        <Menu id="my-action-menu" anchorEl={anchorEl} keepMounted open={Boolean(anchorEl)} onClose={handleClose}>
          {myTurn && <MenuItem onClick={() => onSetActionMode(ActionMode.Mortgage)}>Mortgage</MenuItem>}
          {myTurn && <MenuItem onClick={() => onSetActionMode(ActionMode.Redeem)}>Redeem</MenuItem>}
          {myTurn && <MenuItem onClick={() => onSetActionMode(ActionMode.Build)}>Build</MenuItem>}
          {myTurn && <MenuItem onClick={() => onSetActionMode(ActionMode.Sell)}>Sell</MenuItem>}
          <MenuItem onClick={onViewStats}>Trade / Stats</MenuItem>
          <MenuItem onClick={onViewTaxes}>Taxes</MenuItem>
          <MenuItem onClick={onViewHelp}>Help</MenuItem>
          {myTurn && stillActivePlayer() && <MenuItem onClick={() => { if (window.confirm('Are you sure you wish to resign?')) { onResign(); } }}>Give Up</MenuItem>}
          {!stillActivePlayer() && <MenuItem onClick={() => { if (window.confirm('Are you sure you wish to leave the game?')) { onLeaveGame(); } }}>Leave</MenuItem>}
        </Menu>

      </React.Fragment>
    );
  }



  return (
    <React.Fragment>
      {getMyActions()}

      <HelpDialog />
      <StatsDialog tradeWithPlayer={tradeWithPlayer} />
      <MyTaxesDialog />
    </React.Fragment>
  );

};
