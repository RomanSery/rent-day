/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import { GameContext } from "../../core/types/GameContext";
import { GameState } from "../../core/types/GameState";
import { areObjectIdsEqual, getGameContextFromLocalStorage, getMyUserId, handleApiError } from "../helpers";
import { GameSquare } from "./GameSquare";
import API from '../api';
import { CenterDisplay } from "./CenterDisplay";
import { SocketService } from "../sockets/SocketService";
import { GameEvent } from "../../core/types/GameEvent";
import { Snackbar } from "@material-ui/core";
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

    socketService.listenForEvent(GameEvent.SHOW_SNACK_MSG, (data: any) => {
      setSnackMsg(data);
      setSnackOpen(true);
    });

    socketService.listenForEvent(GameEvent.LEAVE_GAME, (data: any, game: GameState) => {
      updateData(game);
      setSnackMsg(data);
      setSnackOpen(true);
    });


    socketService.listenForEvent(GameEvent.UPDATE_GAME_STATE, (data: GameState) => {
      clearMovement();
      updateData(data);
    });

    socketService.listenForEvent(GameEvent.SHOW_MSG_FROM_SERVER, (data: Array<ServerMsg>) => {
      if (data && data.length > 0) {
        setServerMsg(data[0]);
        setServerMsgModalOpen(true);
      }
    });

    socketService.listenForEvent(GameEvent.SEND_CHANCE_EVENT, (data: Array<ChanceEvent>) => {
      if (data && data.length > 0) {
        setChanceEvent(data[0]);
        setChanceOpen(true);
      }
    });

    socketService.listenForEvent(GameEvent.PLAY_SOUND_EFFECT, (data: Array<SoundMsg>) => {
      if (data && data.length > 0) {
        const msg = data[0];
        if (areObjectIdsEqual(getMyUserId(), msg.playerId)) {
          if (msg.type === SoundType.YourTurn) {
            yourTurnSound.play();
          }
        }
      }
    });

    return function cleanup() {
      if (socketService) {
        socketService.disconnect();
      }
    };
  }, []);



  const closeSnack = (event: React.SyntheticEvent | React.MouseEvent, reason?: string) => {
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
      <div className="board">

        {num_squares.map((n, index) => {
          const id: number = index + 1;
          return (<GameSquare socketService={socketService} id={id} key={id} viewSquare={viewSquare} />)
        })}

        <CenterDisplay socketService={socketService} />
      </div>

      <GamePieces socketService={socketService} />


      <ChanceEventDialog />
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
