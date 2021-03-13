/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import { GameContext } from "../../core/types/GameContext";
import { GameState } from "../../core/types/GameState";
import { areObjectIdsEqual, getGameContextFromLocalStorage, handleApiError } from "../helpers";
import { GameSquare } from "./GameSquare";
import API from '../api';
import { CenterDisplay } from "./CenterDisplay";
import { SocketService } from "../sockets/SocketService";
import { GameEvent } from "../../core/types/GameEvent";
import { Snackbar } from "@material-ui/core";
import { LatencyInfoMsg } from "../../core/types/messages";
import { GamePieces } from "./GamePieces";
import _ from "lodash";
import { ChanceEventDialog } from "../dialogs/ChanceEventDialog";

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

  const [pings, setPings] = useState<LatencyInfoMsg[]>();

  const [squareToView, setSquareToView] = useState<number | undefined>(undefined);

  const [playerIdToMove, setPlayerIdToMove] = React.useState<string>("");
  const [frames, setFrames] = React.useState<Array<number>>([]);





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
    getGameState();
  }, []);


  useEffect(() => {

    socketService.listenForEvent(GameEvent.SHOW_SNACK_MSG, (data: any) => {
      setSnackMsg(data);
      setSnackOpen(true);
    });

    socketService.listenForEvent(GameEvent.LEAVE_GAME, (data: any) => {
      getGameState();
      setSnackMsg(data);
      setSnackOpen(true);
    });

    socketService.listenForEvent(GameEvent.GET_LATENCY, (data: LatencyInfoMsg[]) => {
      setPings(data);
    });

    socketService.sendPingToServer();


    socketService.listenForEvent(GameEvent.UPDATE_GAME_STATE, (data: GameState, showChance?: boolean) => {
      setGameState(data);
      if (showChance && data.results && data.results.chance) {
        setChanceOpen(true);
      }
    });

    return function cleanup() {
      if (socketService) {
        socketService.disconnect();
      }
    };
  }, []);


  const getGameState = () => {
    API.post("getGame", { gameId: context.gameId, context })
      .then(function (response) {
        setGameState(response.data.game);
      })
      .catch(handleApiError);
  };


  const closeSnack = (event: React.SyntheticEvent | React.MouseEvent, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }

    setSnackOpen(false);
  };

  const getPing = (userId: string | undefined) => {
    if (userId && pings) {
      const pingInfo = pings.find(
        (p: LatencyInfoMsg) => areObjectIdsEqual(p.userId, userId)
      );
      if (pingInfo) {
        return "Ping: " + pingInfo.latency + "ms";
      }
    }
    return "Ping: 0ms";
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

  return (
    <React.Fragment>
      <div className="board">
        {num_squares.map((n, index) => {
          const id: number = index + 1;
          return (<GameSquare gameInfo={gameState}
            id={id}
            key={id}
            viewSquare={viewSquare} clearSquare={clearSquare}
          />)
        })}

        <CenterDisplay gameInfo={gameState} socketService={socketService} getPing={getPing} getSquareId={() => squareToView} showMovementAnimation={showMovementAnimation} />
      </div>

      <GamePieces gameInfo={gameState} socketService={socketService}
        getPlayerIdToMove={playerIdToMove} frames={frames} clearMovement={clearMovement} />


      <ChanceEventDialog gameInfo={gameState} open={chanceOpen} onClose={() => setChanceOpen(false)} />

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
