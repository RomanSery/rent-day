/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import { GameContext } from "../../core/types/GameContext";
import { GameState } from "../../core/types/GameState";
import { areObjectIdsEqual, getGameContextFromLocalStorage, getMyUserId, handleApiError } from "../helpers";
import { GameSquare } from "./GameSquare";
import API from '../api';
import { CenterDisplay } from "./CenterDisplay";
import { DisplayPlayers } from "./DisplayPlayers";
import { SocketService } from "../sockets/SocketService";
import { GameEvent } from "../../core/types/GameEvent";
import { Snackbar } from "@mui/material";
import { GamePieces } from "./GamePieces";
import _ from "lodash";
import { ChanceEventDialog } from "../dialogs/ChanceEventDialog";
import { ServerMsgDialog } from "../dialogs/ServerMsgDialog";
import { ServerMsg } from "../../core/types/ServerMsg";
import { ChanceEvent } from "../../core/types/ChanceEvent";
import { SoundType } from "../../core/enums/SoundType";
import { yourTurnSound } from "../gameSounds";
import { SoundMsg } from "../../core/types/SoundMsg";
import useGameStateStore from "../stores/gameStateStore";
import { movementDurationMs } from "../../core/movementTiming";

/** a beat after the piece lands before the Chance card covers the board */
const CHANCE_AFTER_LANDING_MS = 600;
/** open the card anyway if the move never reports that it finished */
const CHANCE_MAX_WAIT_EXTRA_MS = 3000;

interface Props {
  socketService: SocketService;
}



export const GameBoard: React.FC<Props> = ({ socketService }) => {

  const num_squares: Array<number> = Array.from(Array(40));
  const context: GameContext = getGameContextFromLocalStorage();


  const updateData = useGameStateStore(state => state.updateData);
  const setSquareToView = useGameStateStore(state => state.setSquareToView);
  const clearMovement = useGameStateStore(state => state.clearMovement);
  const setSnackMsg = useGameStateStore(state => state.setSnackMsg);
  const setSnackOpen = useGameStateStore(state => state.setSnackOpen);
  const setServerMsg = useGameStateStore(state => state.setServerMsg);
  const setServerMsgModalOpen = useGameStateStore(state => state.setServerMsgModalOpen);
  const setChanceEvent = useGameStateStore(state => state.setChanceEvent);
  const setChanceOpen = useGameStateStore(state => state.setChanceOpen);
  const snackOpen = useGameStateStore(state => state.snackOpen);
  const snackMsg = useGameStateStore(state => state.snackMsg);
  const setWatchers = useGameStateStore(state => state.setWatchers);


  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [size, setSize] = useState([0, 0]);
  useEffect(() => {
    function updateSize() {
      setSize([window.innerWidth, window.innerHeight]);
    }
    window.addEventListener('resize', _.debounce(updateSize, 200));
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, []);



  useEffect(() => {
    API.post("getGame", { gameId: context.gameId, context })
      .then(function (response) {
        updateData(response.data.game);
      })
      .catch(handleApiError);
  }, []);


  useEffect(() => {
    const off: Array<() => void> = [];

    off.push(socketService.listenForEvent(GameEvent.SHOW_SNACK_MSG, (data: any) => {
      setSnackMsg(data);
      setSnackOpen(true);
    }));

    off.push(socketService.listenForEvent(GameEvent.LEAVE_GAME, (data: any, game: GameState) => {
      updateData(game);
      setSnackMsg(data);
      setSnackOpen(true);
    }));


    off.push(socketService.listenForEvent(GameEvent.UPDATE_GAME_STATE, (data: GameState) => {
      clearMovement();
      updateData(data);
    }));

    off.push(socketService.listenForEvent(GameEvent.WATCHERS, (count: number) => {
      setWatchers(count);
    }));

    off.push(socketService.listenForEvent(GameEvent.SHOW_MSG_FROM_SERVER,(data: Array<ServerMsg>) => {
      if (data && data.length > 0) {
        setServerMsg(data[0]);
        setServerMsgModalOpen(true);
      }
    }));

    // The server sends the card a fixed time after the roll, but a long walk
    // (or a card that moves the piece on) can still be animating then, so
    // hold the card until the piece has landed.
    let stopWaitingForLanding: (() => void) | null = null;
    let landedTimer: ReturnType<typeof setTimeout> | null = null;
    let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
    const cancelPendingChance = () => {
      stopWaitingForLanding?.();
      stopWaitingForLanding = null;
      if (landedTimer) {
        clearTimeout(landedTimer);
        landedTimer = null;
      }
      if (maxWaitTimer) {
        clearTimeout(maxWaitTimer);
        maxWaitTimer = null;
      }
    };
    const openChance = (event: ChanceEvent) => {
      cancelPendingChance();
      setChanceEvent(event);
      setChanceOpen(true);
    };
    off.push(cancelPendingChance);

    off.push(socketService.listenForEvent(GameEvent.SEND_CHANCE_EVENT, (data: Array<ChanceEvent>) => {
      if (!data || data.length === 0) {
        return;
      }
      const event = data[0];
      cancelPendingChance();
      const { playerIdToMove, frames } = useGameStateStore.getState();
      if (!playerIdToMove) {
        openChance(event);
        return;
      }
      stopWaitingForLanding = useGameStateStore.subscribe((state) => {
        if (!state.playerIdToMove && !landedTimer) {
          stopWaitingForLanding?.();
          stopWaitingForLanding = null;
          landedTimer = setTimeout(() => openChance(event), CHANCE_AFTER_LANDING_MS);
        }
      });
      maxWaitTimer = setTimeout(() => openChance(event), movementDurationMs(frames) + CHANCE_MAX_WAIT_EXTRA_MS);
    }));

    off.push(socketService.listenForEvent(GameEvent.PLAY_SOUND_EFFECT, (data: Array<SoundMsg>) => {
      if (data && data.length > 0) {
        const msg = data[0];
        if (areObjectIdsEqual(getMyUserId(), msg.playerId)) {
          if (msg.type === SoundType.YourTurn) {
            yourTurnSound.play();
          }
        }
      }
    }));

    return function cleanup() {
      off.forEach((stop) => stop());
      if (socketService) {
        socketService.disconnect();
      }
    };
  }, []);



  const closeSnack = (event: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }

    setSnackOpen(false);
  };


  const viewSquare = (id: number) => {
    setSquareToView(id);
  };


  return (
    <React.Fragment>
      <div className="board game-board">

        {num_squares.map((n, index) => {
          const id: number = index + 1;
          return (<GameSquare socketService={socketService} id={id} key={id} viewSquare={viewSquare} />)
        })}

        {/* Middle of the board on portrait phones, where the controls move
            below the board (mobile.css). Always rendered so that rotating the
            phone never remounts CenterDisplay, whose socket listeners can't
            be removed and would double up. */}
        <div className="board-hub">
          <DisplayPlayers />
        </div>

        <CenterDisplay socketService={socketService} />
      </div>

      <GamePieces socketService={socketService} />


      <ChanceEventDialog socketService={socketService} />
      <ServerMsgDialog />

      <Snackbar
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        onClose={closeSnack}
        open={snackOpen} autoHideDuration={5000} message={snackMsg}
      />

    </React.Fragment>
  );
}
