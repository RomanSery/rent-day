import React, { useEffect, useState } from "react";
import { GameContext } from "../../core/types/GameContext";
import { GameState } from "../../core/types/GameState";
import { getGameContextFromLocalStorage } from "../helpers";
import { GameSquare } from "./GameSquare";
import API from '../api';
import { CenterDisplay } from "./CenterDisplay";
import { SocketService } from "../sockets/SocketService";
import { GameEvent } from "../../core/types/GameEvent";
import { Snackbar } from "@material-ui/core";
import _ from "lodash";

interface Props {
  socketService: SocketService;
}

export const GameBoard: React.FC<Props> = ({ socketService }) => {

  const num_squares: Array<number> = Array.from(Array(40));
  const context: GameContext = getGameContextFromLocalStorage();

  const [gameState, setGameState] = useState<GameState>();
  const [snackOpen, setSnackOpen] = useState<boolean>(false);
  const [snackMsg, setSnackMsg] = useState<string>("");
  const [pings, setPings] = useState();

  useEffect(() => {
    getGameState();
  }, [context.gameId, context.playerId]);


  useEffect(() => {

    socketService.listenForEvent(GameEvent.LEAVE_GAME, (data: any) => {
      setSnackMsg(data);
      setSnackOpen(true);
    });

    socketService.listenForEvent(GameEvent.GET_LATENCY, (data: any) => {
      setPings(data);
    });

    socketService.sendPingToServer();


    socketService.listenForEvent(GameEvent.UPDATE_GAME_STATE, (data: any) => {
      console.log("UPDATE_GAME_STATE");
      getGameState();
    });

    return function cleanup() {
      if (socketService) {
        socketService.disconnect();
      }
    };
  }, [context.gameId]);


  const getGameState = () => {
    API.post("getGame", { gameId: context.gameId })
      .then(function (response) {
        setGameState(response.data.game);
      })
      .catch(function (error) {
        console.log(error);
      });
  };


  const closeSnack = (event: React.SyntheticEvent | React.MouseEvent, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }

    setSnackOpen(false);
  };

  const getPing = (playerId: string | undefined) => {
    if (playerId) {
      const pingInfo = _.filter(pings, { 'playerId': playerId });
      if (pingInfo && pingInfo.length > 0) {
        return "Ping: " + pingInfo[0].latency + "ms";
      }
    }
    return "Ping: 0ms";
  }

  return (
    <React.Fragment>
      <div className="board">

        {num_squares.map((n, index) => {
          const id: number = index + 1;

          return (<GameSquare gameInfo={gameState}
            id={id}
            key={id}
          />)
        })}

        <CenterDisplay gameInfo={gameState} socketService={socketService} getPing={getPing} />
      </div>


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
