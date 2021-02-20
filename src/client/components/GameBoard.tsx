import React, { useEffect, useState } from "react";
import { GameContext } from "../../core/types/GameContext";
import { GameState } from "../../core/types/GameState";
import { areObjectIdsEqual, getGameContextFromLocalStorage, getIconProp, getObjectIdAsHexString, handleApiError } from "../helpers";
import { GameSquare } from "./GameSquare";
import API from '../api';
import { CenterDisplay } from "./CenterDisplay";
import { SocketService } from "../sockets/SocketService";
import { GameEvent } from "../../core/types/GameEvent";
import { Snackbar } from "@material-ui/core";
import { LatencyInfoMsg } from "../../core/types/messages";
import { PlayerState } from "../../core/enums/PlayerState";
import { Player } from "../../core/types/Player";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { PiecePosition } from "../../core/types/PiecePosition";
import { getPiecePosition } from "../uiHelpers";
import { animate } from "framer-motion";

interface Props {
  socketService: SocketService;
}

export const GameBoard: React.FC<Props> = ({ socketService }) => {

  const num_squares: Array<number> = Array.from(Array(40));
  const context: GameContext = getGameContextFromLocalStorage();

  const [gameState, setGameState] = useState<GameState>();
  const [snackOpen, setSnackOpen] = useState<boolean>(false);
  const [snackMsg, setSnackMsg] = useState<string>("");
  const [pieceToMovePos, setPieceToMovePos] = useState<DOMRect | null>(null);

  const [pings, setPings] = useState<LatencyInfoMsg[]>();

  const [squareToView, setSquareToView] = useState<number | undefined>(undefined);


  useEffect(() => {
    getGameState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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


    socketService.listenForEvent(GameEvent.UPDATE_GAME_STATE, (data: GameState) => {
      setGameState(data);
    });

    return function cleanup() {
      if (socketService) {
        socketService.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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


  const getNumPlayersOnSquare = (squareId: number) => {
    if (!gameState) {
      return 0;
    }

    return gameState.players.filter((p) => p.position === squareId && p.state !== PlayerState.BANKRUPT).length;
  }

  const displayGamePieces = () => {
    if (!gameState) {
      return null;
    }
    return (
      <React.Fragment>
        {num_squares.map((n, index) => {
          const id: number = index + 1;
          const numOnSquare = getNumPlayersOnSquare(id);
          if (numOnSquare > 0) {
            return displayPiecesForSquare(id);
          }
          return null;
        })}
      </React.Fragment>
    );
  }

  const getPieceId = (p: Player) => {
    return "player-" + p._id;
  }

  const displayPiecesForSquare = (squareId: number) => {
    return (
      <React.Fragment>
        {gameState!.players.filter((p) => p.state !== PlayerState.BANKRUPT && p.position === squareId).map((p: Player, index) => {

          const pos: PiecePosition = getPiecePosition(gameState!, squareId, index);
          return (
            <div className="single-piece" id={getPieceId(p)} key={getObjectIdAsHexString(p._id)}
              style={{ top: pos.top, left: pos.left, bottom: pos.bottom, right: pos.right }}>
              <FontAwesomeIcon icon={getIconProp(p.type)} color={p.color} size="2x" />
            </div>);

        })}
      </React.Fragment>
    );
  }

  const showMovementAnimation = (origPos: number, newPos: number, playerId: string) => {
    const from: PiecePosition = getPiecePosition(gameState!, origPos, 0);
    const to: PiecePosition = getPiecePosition(gameState!, newPos, 0);

    //console.log("from = " + from + ", to = " + to);

    /*
        const controls = animate(from, to, {
          type: "tween",
          duration: 8,
          onUpdate: (value: number) => {
            setAnimValue(Math.round(value))
          },
          onComplete: () => {
            setShowResult(true);
    
            setTimeout(() => {
              if (socketService && gameInfo) {
                socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameInfo._id);
              }
            }, 3000);
          }
        });*/
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


      {displayGamePieces()}

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
