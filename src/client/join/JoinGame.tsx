import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { GameContext } from "../../core/types/GameContext";
import { GameState } from "../../core/types/GameState";
import { getGameContextFromLocalStorage, getMyGameId, hasJoinedGame, leaveCurrentGameIfJoined, setJoinedGameStorage } from "../helpers";
import API from '../api';
import { Player } from "../../core/types/Player";
import { useForm, SubmitHandler } from "react-hook-form";
import { PieceType } from "../../core/enums/PieceType";
import { SocketService } from "../sockets/SocketService";
import { GameEvent } from "../../core/types/GameEvent";
import { GamePiece } from "../components/GamePiece";
import { Button, FormControl, InputLabel, MenuItem, NativeSelect, Select, Snackbar, TextField } from "@material-ui/core";
import { JoinedGameMsg } from "../../core/types/messages";

interface Props {
  socketService: SocketService;
}

type Inputs = {
  playerName: string;
  piece: PieceType;
};

export const JoinGame: React.FC<Props> = ({ socketService }) => {

  const history = useHistory();
  const context: GameContext = getGameContextFromLocalStorage();

  const [gameState, setGameState] = useState<GameState>();
  const [snackOpen, setSnackOpen] = useState<boolean>(false);
  const [snackMsg, setSnackMsg] = useState<string>("");
  const { register, handleSubmit, errors } = useForm<Inputs>();


  useEffect(() => {
    getGameState();
  }, [context.gameId, context.playerId]);


  useEffect(() => {

    socketService.listenForEvent(GameEvent.JOINED_GAME, (data: JoinedGameMsg) => {
      if (data.allJoined) {
        history.push("/gameinstance");
      } else {
        getGameState();
        setSnackMsg(data.playerName + " has joined");
        setSnackOpen(true);
      }
    });

    socketService.listenForEvent(GameEvent.LEAVE_GAME, (data: any) => {
      setSnackMsg(data);
      setSnackOpen(true);
    });

    socketService.listenForEvent(GameEvent.GET_LATENCY, (data: any) => {
      console.log(data);
    });

    socketService.sendPingToServer();


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


  const onJoinGame: SubmitHandler<Inputs> = (data) => {

    API.post("joinGame", { gameId: context.gameId, name: data.playerName, piece: data.piece })
      .then(function (response) {
        if (socketService) {
          socketService.socket.emit(GameEvent.JOINED_GAME, {
            playerName: response.data.playerName,
            playerId: response.data.playerId,
            allJoined: response.data.allJoined,
            gameId: context.gameId
          });
        }

        setJoinedGameStorage(context.gameId, response.data.playerId, response.data.playerName);
        getGameState();
      })
      .catch(function (error) {
        console.log(error);
      });

  };

  const getColorStyle = (): React.CSSProperties => {
    return { borderColor: "#000000" };
  };

  const onLeaveGame = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.preventDefault();

    socketService.socket.emit(GameEvent.LEAVE_GAME, getMyGameId());

    leaveCurrentGameIfJoined(() => {
      history.push("/");
    });
  };

  const closeSnack = (event: React.SyntheticEvent | React.MouseEvent, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }

    setSnackOpen(false);
  };


  return (
    <React.Fragment>
      <div className="player-actions">
        <p>
          name: {gameState?.name}
        </p>
        <p>
          max players: {gameState?.settings.maxPlayers}
        </p>
        <p>
          num joined: {gameState?.players.length}
        </p>

        {!hasJoinedGame() &&
          <form onSubmit={handleSubmit(onJoinGame)}>

            <TextField label="Name" fullWidth={true} name="playerName" required={true}
              inputRef={register({ required: true, maxLength: 10, minLength: 4 })} />

            <FormControl >
              <InputLabel htmlFor="piece-type">Piece Type</InputLabel>
              <NativeSelect id="piece-type" name="piece" required={true} fullWidth={true} inputRef={register({ required: true })} >
                <option value="1">Pawn</option>
                <option value="2">Hat</option>
                <option value="3">Car</option>
                <option value="4">Bicycle</option>
                <option value="5">Cat</option>
                <option value="6">Dog</option>
              </NativeSelect>

            </FormControl>

            <br />

            <input type="submit" value="Join" />
          </form>
        }

        {hasJoinedGame() &&
          <Button variant="contained" color="secondary" onClick={onLeaveGame}>
            Leave Game
         </Button>
        }

      </div>

      <div className="players-display">
        {gameState?.players.map((p: Player, index) => {
          return (
            <React.Fragment key={p._id}>
              <div className="player-info" style={getColorStyle()}>
                <div className="container">
                  <div className="name">
                    {p.name}
                  </div>
                  <div className="icon">
                    <GamePiece type={p.type} color="#000000" />
                  </div>
                </div>
              </div>
            </React.Fragment>
          )
        })}
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
