/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import { GameContext } from "../../core/types/GameContext";
import { GameState } from "../../core/types/GameState";
import { getGameContextFromLocalStorage, handleApiError } from "../helpers";
import { GameSquare } from "./GameSquare";
import API from '../api';
import { CenterDisplay } from "./CenterDisplay";
import { SocketService } from "../sockets/SocketService";
import { GameEvent } from "../../core/types/GameEvent";
import { Snackbar } from "@material-ui/core";
import { GamePieces } from "./GamePieces";
import _ from "lodash";
import { ChanceEventDialog } from "../dialogs/ChanceEventDialog";
import { ActionMode } from "../../core/enums/ActionMode";
import { ServerMsgDialog } from "../dialogs/ServerMsgDialog";
import { ServerMsg } from "../../core/types/ServerMsg";
import { ChanceEvent } from "../../core/types/ChanceEvent";

interface Props {
  socketService: SocketService;
}

export const GameBoard: React.FC<Props> = ({ socketService }) => {

  const num_squares: Array<number> = Array.from(Array(40));
  const context: GameContext = getGameContextFromLocalStorage();

  const [gameState, setGameState] = useState<GameState>();
  const [snackOpen, setSnackOpen] = useState<boolean>(false);
  const [snackMsg, setSnackMsg] = useState<string>("");
  const [chanceOpen, setChanceOpen] = useState(false);
  const [chanceEvent, setChanceEvent] = useState<ChanceEvent | undefined>(undefined);


  const [serverMsgModalOpen, setServerMsgModalOpen] = useState(false);
  const [serverMsg, setServerMsg] = useState<ServerMsg | undefined>(undefined);

  const [squareToView, setSquareToView] = useState<number | undefined>(undefined);

  const [playerIdToMove, setPlayerIdToMove] = React.useState<string>("");
  const [frames, setFrames] = React.useState<Array<number>>([]);

  const [actionMode, setActionMode] = React.useState<ActionMode>(ActionMode.None);




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
        setGameState(response.data.game);
      })
      .catch(handleApiError);
  }, []);


  useEffect(() => {

    socketService.listenForEvent(GameEvent.SHOW_SNACK_MSG, (data: any) => {
      setSnackMsg(data);
      setSnackOpen(true);
    });

    socketService.listenForEvent(GameEvent.LEAVE_GAME, (data: any, game: GameState) => {
      setGameState(game);
      setSnackMsg(data);
      setSnackOpen(true);
    });


    socketService.listenForEvent(GameEvent.UPDATE_GAME_STATE, (data: GameState) => {
      clearMovement();
      setGameState(data);
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
  const clearSquare = () => {
    //setSquareToView(undefined);
  };

  const showMovementAnimation = (playerId: string, frames: Array<number>) => {
    setFrames(frames);
    setPlayerIdToMove(playerId);
  }

  const clearMovement = () => {
    setPlayerIdToMove("");
    setFrames([]);
  }

  const getPlayerIdToMove = () => {
    return playerIdToMove;
  }

  return (
    <React.Fragment>
      <div className="board">
        {num_squares.map((n, index) => {
          const id: number = index + 1;
          return (<GameSquare gameInfo={gameState} socketService={socketService}
            id={id}
            key={id}
            viewSquare={viewSquare} clearSquare={clearSquare} actionMode={actionMode}
          />)
        })}

        <CenterDisplay gameInfo={gameState} socketService={socketService} getSquareId={() => squareToView} showMovementAnimation={showMovementAnimation}
          actionMode={actionMode} setActionMode={setActionMode} />
      </div>

      <GamePieces gameInfo={gameState} socketService={socketService}
        getPlayerIdToMove={getPlayerIdToMove} frames={frames} clearMovement={clearMovement} />


      <ChanceEventDialog open={chanceOpen} chanceEvent={chanceEvent} onClose={() => setChanceOpen(false)} />
      <ServerMsgDialog open={serverMsgModalOpen} msg={serverMsg} onClose={() => setServerMsgModalOpen(false)} />

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
