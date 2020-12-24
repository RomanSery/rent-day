import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { GameContext } from "../../core/types/GameContext";
import { GameState } from "../../core/types/GameState";
import { getGameContextFromLocalStorage, getIconProp, getMyGameId, hasJoinedGame, leaveCurrentGameIfJoined, setJoinedGameStorage } from "../helpers";
import API from '../api';
import { Player } from "../../core/types/Player";
import { useForm, SubmitHandler } from "react-hook-form";
import { PieceType } from "../../core/enums/PieceType";
import { SocketService } from "../sockets/SocketService";
import { GameEvent } from "../../core/types/GameEvent";
import { Button, Chip, Container, FormControl, InputLabel, List, ListItem, ListItemIcon, ListItemText, NativeSelect, Snackbar, TextField, Typography } from "@material-ui/core";
import { JoinedGameMsg } from "../../core/types/messages";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers, faDollarSign } from "@fortawesome/free-solid-svg-icons";
import _ from "lodash";
import { PlayerClass } from "../../core/enums/PlayerClass";


interface Props {
  socketService: SocketService;
}

type Inputs = {
  playerName: string;
  piece: PieceType;
  playerClass: PlayerClass;
};

export const JoinGame: React.FC<Props> = ({ socketService }) => {

  const history = useHistory();
  const context: GameContext = getGameContextFromLocalStorage();

  const [gameState, setGameState] = useState<GameState>();
  const [snackOpen, setSnackOpen] = useState<boolean>(false);
  const [snackMsg, setSnackMsg] = useState<string>("");
  const [pings, setPings] = useState();


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
      getGameState();
    });

    socketService.listenForEvent(GameEvent.GET_LATENCY, (data: any) => {
      setPings(data);
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

    API.post("joinGame", { gameId: context.gameId, name: data.playerName, piece: data.piece, playerClass: data.playerClass })
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

        if (response.data.allJoined) {
          history.push("/gameinstance");
        }
      })
      .catch(function (error) {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          alert(error.response.data);
        } else if (error.request) {
          // The request was made but no response was received
          // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
          // http.ClientRequest in node.js
          console.log(error.request);
        } else {
          // Something happened in setting up the request that triggered an Error
          console.log('Error', error.message);
        }
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

  const getNumPlayers = () => {
    return "Players: " + gameState?.players.length + " / " + gameState?.settings.maxPlayers;
  }

  const getPing = (playerId: string | undefined) => {
    if (playerId) {
      const pingInfo = _.filter(pings, { 'playerId': playerId });
      if (pingInfo && pingInfo.length > 0) {
        return "Ping: " + pingInfo[0].latency + "ms";
      }
    }
    return "";
  }


  return (
    <React.Fragment>
      <Container maxWidth="xs">
        <Typography component="h2" variant="h5">{gameState?.name}</Typography>

        <List dense={true} className="game-settings">
          <ListItem>
            <ListItemIcon> <FontAwesomeIcon icon={faUsers} size="2x" /> </ListItemIcon>
            <ListItemText primary={getNumPlayers()} />
          </ListItem>
          <ListItem>
            <ListItemIcon> <FontAwesomeIcon icon={faDollarSign} size="2x" /> </ListItemIcon>
            <ListItemText primary={gameState?.settings.initialMoney} />
          </ListItem>
        </List>


        {!hasJoinedGame() &&
          <form onSubmit={handleSubmit(onJoinGame)}>

            <TextField label="Name" fullWidth={true} name="playerName" required={true}
              inputRef={register({ required: true, maxLength: 10, minLength: 4 })} />

            <FormControl fullWidth >
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

            <FormControl fullWidth >
              <InputLabel htmlFor="class-type">Class Type</InputLabel>
              <NativeSelect id="class-type" name="playerClass" required={true} fullWidth={true} inputRef={register({ required: true })} >
                <option value="1">Broker</option>
                <option value="2">Conductor</option>
                <option value="3">Banker</option>
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

      </Container>

      <div className="players-display">
        {gameState?.players.map((p: Player, index) => {
          return (
            <React.Fragment key={p._id}>
              <div className="player-info" style={getColorStyle()}>
                <div className="container">
                  <Chip clickable={false} color="primary" size="medium" variant="outlined"
                    icon={<FontAwesomeIcon icon={getIconProp(p.type)} size="2x" />}
                    label={p.name} />
                  <div className="player-class">{PlayerClass[p.playerClass]}</div>
                  <div className="ping">{getPing(p._id)}</div>

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
