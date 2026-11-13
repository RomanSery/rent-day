/* eslint-disable react-hooks/exhaustive-deps */
import React from "react";
import { Button, CircularProgress, Menu, MenuItem } from "@mui/material";
import { areObjectIdsEqual, getGameContextFromLocalStorage, getMyUserId, handleApiError, leaveCurrentGameIfJoined, resignCurrGame } from "../helpers";
import { useNavigate } from "react-router-dom";
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
import { SkillPointsButton } from "./SkillPointsButton";
import { countEligibleSquares } from "../squares/actionEligibility";
import useGameStateStore from "../stores/gameStateStore";


interface Props {
  socketService: SocketService;
  tradeWithPlayer: (player: Player) => void;
  onRollAction: () => void;
  onTravelAction: () => void;
}

export const DisplayActions: React.FC<Props> = ({ socketService, onRollAction, onTravelAction, tradeWithPlayer }) => {

  const context: GameContext = getGameContextFromLocalStorage();
  const navigate = useNavigate();

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

  // Done answers at once; the button goes away when the new game state arrives
  const [endingTurn, setEndingTurn] = React.useState(false);

  React.useEffect(() => {
    socketService.listenForEvent(GameEvent.UPDATE_GAME_STATE, (data: any) => {
      setRollBtnHidden(false);
      setEndingTurn(false);
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
    if (endingTurn) {
      return;
    }
    setEndingTurn(true);
    API.post("actions/completeTurn", { context })
      .then(function (response) {
        if (socketService && gameState) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameState._id, true);
        }
      })
      .catch((err) => {
        setEndingTurn(false);
        handleApiError(err);
      });
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
      navigate("/dashboard");
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
        <motion.div animate={{ scale: 1.05 }} transition={{
          duration: 1.0,
          repeat: Infinity,
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
    if (canCompleteTurn() && endingTurn) {
      return (
        <Button variant="contained" color="primary" disabled
          startIcon={<CircularProgress size={14} color="inherit" />}>Ending turn…</Button>
      );
    }
    if (canCompleteTurn()) {
      return (
        <motion.div animate={{ scale: 1.05 }} transition={{
          duration: 1.0,
          repeat: Infinity,
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

  /** what to do in an action mode, or that there's nothing to do */
  const getActionDescription = (available: number) => {
    const texts: Partial<Record<ActionMode, [string, string]>> = {
      [ActionMode.Mortgage]: ["Tap a highlighted property to mortgage it", "Nothing you can mortgage right now"],
      [ActionMode.Redeem]: ["Tap a highlighted property to redeem it", "Nothing you can redeem right now"],
      [ActionMode.Build]: ["Tap a highlighted property to build a house", "Nowhere you can build right now"],
      [ActionMode.Sell]: ["Tap a highlighted property to sell a house", "No houses you can sell right now"],
    };
    const [some, none] = texts[actionMode] ?? ["", ""];
    return available > 0 ? some : none;
  }


  const getMyActions = () => {
    const myTurn = !!isMyTurn();
    const me = getMyPlayer();

    if (actionMode !== ActionMode.None) {
      const available = gameState ? countEligibleSquares(gameState, actionMode, getMyUserId()) : 0;
      return (
        <div className={"action-mode-hint" + (available === 0 ? " none" : "")}>
          <span>{getActionDescription(available)}</span>
          {available > 0 && <span className="action-mode-count">{available} available</span>}
          <Button variant="contained" color="primary" size="small" onClick={onFinishAction}>Done</Button>
        </div>
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

        {me && <SkillPointsButton socketService={socketService} me={me} />}

        <Button endIcon={<FontAwesomeIcon icon={faCaretDown} />} variant="outlined" color="primary" aria-controls="my-action-menu" aria-haspopup="true" onClick={handleClick}>Actions</Button>
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
