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
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { BoardSection } from "../../core/enums/BoardSection";

interface Props {
  socketService: SocketService;
}

export const GameBoard: React.FC<Props> = ({ socketService }) => {

  const num_squares: Array<number> = Array.from(Array(40));
  const context: GameContext = getGameContextFromLocalStorage();

  const [gameState, setGameState] = useState<GameState>();
  const [snackOpen, setSnackOpen] = useState<boolean>(false);
  const [snackMsg, setSnackMsg] = useState<string>("");
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

  const getTopPosition = (rect: DOMRect, section: BoardSection) => {
    if (section === BoardSection.Bottom) {
      return rect.top + (rect.height / 2);
    }
    if (section === BoardSection.Top) {
      return (rect.height / 4);
    }

    return rect.top;
  }

  const getLeftPosition = (rect: DOMRect, section: BoardSection, numOnSquare: number, index: number) => {
    let offset = 0;
    if (numOnSquare > 1 && index > 0) {
      const multiplier = numOnSquare === 2 ? 3 : (numOnSquare >= 4 ? 8 : 4);
      const divisionFactor = numOnSquare * multiplier;
      offset = (index * numOnSquare * (rect.width / divisionFactor));
    }


    if (section === BoardSection.Right) {
      return rect.left + (rect.width / 8) + offset;
    }

    return rect.left + offset;
  }

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

  const displayPiecesForSquare = (squareId: number) => {
    return (
      <React.Fragment>
        {gameState!.players.filter((p) => p.state !== PlayerState.BANKRUPT && p.position === squareId).map((p: Player, index) => {

          const numOnSquare = getNumPlayersOnSquare(squareId);
          const section: BoardSection = SquareConfigDataMap.get(squareId)?.section!;
          const square = document.getElementById('game-square-' + squareId);
          const rect: DOMRect = square!.getBoundingClientRect();
          const bottom = rect.bottom;
          const right = rect.right;

          return (
            <div className="single-piece" key={getObjectIdAsHexString(p._id)}
              style={{ top: getTopPosition(rect, section), left: getLeftPosition(rect, section, numOnSquare, index), bottom: bottom, right: right }}>
              <FontAwesomeIcon icon={getIconProp(p.type)} color={p.color} size="2x" />
            </div>);

        })}
      </React.Fragment>
    );
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

        <CenterDisplay gameInfo={gameState} socketService={socketService} getPing={getPing} getSquareId={() => squareToView} />
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
