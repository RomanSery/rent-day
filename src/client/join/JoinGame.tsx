import React, { useEffect, useState } from "react";

import { useHistory } from "react-router-dom";
import { GameContext } from "../../core/types/GameContext";
import { GameState } from "../../core/types/GameState";
import { areObjectIdsEqual, getGameContextFromLocalStorage, getIconProp, getMyGameId, getObjectIdAsHexString, handleApiError, hasJoinedGame, leaveCurrentGameIfJoined, setJoinedGameStorage } from "../helpers";
import API from '../api';
import { Player } from "../../core/types/Player";
import { useForm, SubmitHandler } from "react-hook-form";
import { PieceType } from "../../core/enums/PieceType";
import { SocketService } from "../sockets/SocketService";
import { GameEvent } from "../../core/types/GameEvent";
import { Button, Chip, Container, FormControl, InputLabel, List, ListItem, ListItemIcon, ListItemText, NativeSelect, Snackbar, Typography } from "@material-ui/core";
import { JoinedGameMsg, LatencyInfoMsg } from "../../core/types/messages";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers, faDollarSign } from "@fortawesome/free-solid-svg-icons";
import { PlayerClass } from "../../core/enums/PlayerClass";
import { corruptionAdjustment, luckAdjustment, negotiationAdjustment } from "../../core/constants";
import { getPlayerClassDescription } from "../uiHelpers";

interface Props {
  socketService: SocketService;
}

type Inputs = {
  piece: PieceType;
  playerClass: PlayerClass;
};

export const JoinGame: React.FC<Props> = ({ socketService }) => {

  const history = useHistory();
  const context: GameContext = getGameContextFromLocalStorage();

  const [gameState, setGameState] = useState<GameState>();
  const [snackOpen, setSnackOpen] = useState<boolean>(false);
  const [snackMsg, setSnackMsg] = useState<string>("");
  const [pings, setPings] = useState<LatencyInfoMsg[]>();
  const [selectedPlayerClass, setSelectedPlayerClass] = useState<string | undefined>(undefined);

  const { register, handleSubmit } = useForm<Inputs>();


  useEffect(() => {
    getGameState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);




  const getGameState = () => {
    API.post("getGame", { gameId: context.gameId, context })
      .then(function (response) {
        setGameState(response.data.game);
      })
      .catch(handleApiError);
  };


  const onJoinGame: SubmitHandler<Inputs> = (data) => {

    API.post("joinGame", { gameId: context.gameId, piece: data.piece, playerClass: data.playerClass, context })
      .then(function (response) {
        if (socketService) {
          socketService.socket.emit(GameEvent.JOINED_GAME, {
            playerName: response.data.playerName,
            userId: response.data.userId,
            allJoined: response.data.allJoined,
            gameId: context.gameId
          });
        }

        if (context.gameId) {
          setJoinedGameStorage(context.gameId);
        }
        getGameState();

        if (response.data.allJoined) {
          history.push("/gameinstance");
        }
      })
      .catch(handleApiError);

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

  const handlePlayerClassChange = (event: React.ChangeEvent<{ name?: string; value: string }>) => {
    setSelectedPlayerClass(event.target.value);
  };

  return (
    <React.Fragment>
      <Container maxWidth="sm">
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

            <FormControl fullWidth >
              <InputLabel htmlFor="piece-type">Piece Type</InputLabel>
              <NativeSelect id="piece-type" name="piece" required={true} fullWidth={true}
                inputRef={register({ required: true })} >
                <option aria-label="None" value="" />
                <option value="Pawn">Pawn</option>
                <option value="Hat">Hat</option>
                <option value="Car">Car</option>
                <option value="Bicycle">Bicycle</option>
                <option value="Cat">Cat</option>
                <option value="Dog">Dog</option>
              </NativeSelect>
            </FormControl>

            <FormControl fullWidth >
              <InputLabel htmlFor="class-type">Class Type</InputLabel>
              <NativeSelect id="class-type" name="playerClass" required={true} fullWidth={true} inputRef={register({ required: true })} onChange={handlePlayerClassChange} >
                <option aria-label="None" value="" />
                <option value="Banker">Banker</option>
                <option value="Conductor">Conductor</option>
                <option value="Gambler">Gambler</option>
                <option value="Governor">Governor</option>
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

        <div className="player-class-description">
          {getPlayerClassDescription(selectedPlayerClass)}
        </div>

        <div className="skill-descriptions">
          <div className="skill">
            <div className="header">Luck</div>
            <div className="description">Each point <b>increases</b> your chance to win lotto prizes by <b>{luckAdjustment}</b>%</div>
          </div>
          <div className="skill">
            <div className="header">Negotiation</div>
            <div className="description">Each point <b>lowers</b> the rent you pay by <b>{negotiationAdjustment}</b>%</div>
          </div>
          <div className="skill">
            <div className="header">Corruption</div>
            <div className="description">Each point <b>lowers</b> your taxes per turn by <b>{corruptionAdjustment}</b>%</div>
          </div>
        </div>


      </Container>

      <div className="players-display">
        {gameState?.players.map((p: Player, index) => {
          return (
            <React.Fragment key={getObjectIdAsHexString(p._id)}>
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
