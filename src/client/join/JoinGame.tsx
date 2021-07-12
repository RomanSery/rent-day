/* eslint-disable react/jsx-no-target-blank */
import React, { useEffect, useState } from "react";

import { useHistory, useLocation } from "react-router-dom";
import { GameState } from "../../core/types/GameState";
import { getIconProp, getObjectIdAsHexString, handleApiError, hasJoinedGame, leaveCurrentGameIfJoined, setJoinedGameStorage } from "../helpers";
import API from '../api';
import { Player } from "../../core/types/Player";
import { useForm, SubmitHandler } from "react-hook-form";
import { PieceType } from "../../core/enums/PieceType";
import { SocketService } from "../sockets/SocketService";
import { GameEvent } from "../../core/types/GameEvent";
import { Button, Chip, Container, TextField, FormControl, InputLabel, List, ListItem, ListItemIcon, ListItemText, NativeSelect, Snackbar, Typography } from "@material-ui/core";
import { JoinedGameMsg } from "../../core/types/messages";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers, faDollarSign } from "@fortawesome/free-solid-svg-icons";
import { PlayerClass } from "../../core/enums/PlayerClass";
import { corruptionAdjustment, luckAdjustment, negotiationAdjustment } from "../../core/constants";
import { getPlayerClassDescription } from "../uiHelpers";
import queryString from "query-string";
import _ from "lodash/fp";
import { useQuery } from "react-query";
import { Share } from "react-twitter-widgets";
import { Helmet } from "react-helmet";

interface Props {
  socketService: SocketService;
}

type Inputs = {
  piece: PieceType;
  playerClass: PlayerClass;
  gamePwd: string | null;
};

export const JoinGame: React.FC<Props> = ({ socketService }) => {

  const history = useHistory();
  const location = useLocation();

  const getGameIdFromUrl = () => {
    const parsed = queryString.parse(location.search);
    return parsed.gid as string;
  };

  const gameToJoinId: string | null = getGameIdFromUrl();

  const [snackOpen, setSnackOpen] = useState<boolean>(false);
  const [snackMsg, setSnackMsg] = useState<string>("");
  const [selectedPlayerClass, setSelectedPlayerClass] = useState<string | undefined>(undefined);

  const { register, handleSubmit, errors } = useForm<Inputs>();

  const gameInfoQuery = useQuery<GameState, Error>("getAllPlayers",
    () => API.post("getGame", { gameId: gameToJoinId }).then(function (response) { return response.data.game; }));


  useEffect(() => {

    socketService.listenForEvent(GameEvent.JOINED_GAME, (data: JoinedGameMsg) => {
      if (data.allJoined) {
        history.push("/gameinstance");
      } else {
        gameInfoQuery.refetch();
        setSnackMsg(data.playerName + " has joined");
        setSnackOpen(true);
      }
    });

    socketService.listenForEvent(GameEvent.LEAVE_GAME, (data: any, game: GameState) => {
      setSnackMsg(data);
      setSnackOpen(true);
      gameInfoQuery.refetch();
    });


    return function cleanup() {
      if (socketService) {
        socketService.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const onJoinGame: SubmitHandler<Inputs> = (data) => {

    API.post("joinGame", { gameId: gameToJoinId, piece: data.piece, playerClass: data.playerClass, gamePwd: data.gamePwd })
      .then(function (response) {
        if (socketService) {
          socketService.socket.emit(GameEvent.JOINED_GAME, {
            playerName: response.data.playerName,
            userId: response.data.userId,
            allJoined: response.data.allJoined,
            gameId: gameToJoinId
          });
        }

        if (gameToJoinId) {
          setJoinedGameStorage(gameToJoinId);
        }
        gameInfoQuery.refetch();

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

    leaveCurrentGameIfJoined(socketService, () => {
      history.push("/dashboard");
    });
  };

  const closeSnack = (event: React.SyntheticEvent | React.MouseEvent, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }

    setSnackOpen(false);
  };

  const getNumPlayers = () => {
    if (gameInfoQuery.isLoading || !gameInfoQuery.data) {
      return "Loading...";
    }
    if (gameInfoQuery.isError) {
      return gameInfoQuery.error!.message;
    }
    return "Players: " + gameInfoQuery.data.players.length + " / " + gameInfoQuery.data.settings.maxPlayers;
  }


  const handlePlayerClassChange = (event: React.ChangeEvent<{ name?: string; value: string }>) => {
    setSelectedPlayerClass(event.target.value);
  };


  const getListOfJoinePlayers = () => {
    if (gameInfoQuery.isLoading || !gameInfoQuery.data) {
      return "Loading...";
    }
    if (gameInfoQuery.isError) {
      return gameInfoQuery.error!.message;
    }

    return (<div className="players-display">
      {gameInfoQuery.data.players.map((p: Player, index) => {
        return (
          <React.Fragment key={getObjectIdAsHexString(p._id)}>
            <div className="player-info" style={getColorStyle()}>
              <div className="container">
                <Chip clickable={false} color="primary" size="medium" variant="outlined"
                  icon={<FontAwesomeIcon icon={getIconProp(p.type)} size="2x" />}
                  label={p.name} />
                <div className="player-class">{PlayerClass[p.playerClass]}</div>
              </div>
            </div>
          </React.Fragment>
        )
      })}
    </div>);
  }

  const shareUrl = window.location.href;


  const getShareTitle = () => {
    return "Let's play a game of Rent Day";
  };

  return (
    <React.Fragment>
      <Helmet>
        <meta property="og:url" content={shareUrl} />
      </Helmet>

      <Container maxWidth="sm">
        <Typography component="h2" variant="h5">{gameInfoQuery.data?.name}</Typography>

        <List dense={true} className="game-settings">
          <ListItem>
            <ListItemIcon> <FontAwesomeIcon icon={faUsers} size="2x" /> </ListItemIcon>
            <ListItemText primary={getNumPlayers()} />
          </ListItem>
          <ListItem>
            <ListItemIcon> <FontAwesomeIcon icon={faDollarSign} size="2x" /> </ListItemIcon>
            <ListItemText primary={gameInfoQuery.data?.settings.initialMoney} />
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
            {_.get("piece.type", errors) === "required" && (
              <p className="field-error">Piece Type is required</p>
            )}

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
            {_.get("playerClass.type", errors) === "required" && (
              <p className="field-error">Class Type is required</p>
            )}

            {gameInfoQuery && gameInfoQuery.data && gameInfoQuery.data.settings && gameInfoQuery.data.settings.password &&
              <FormControl fullWidth >
                <TextField id="gamePwd" name="gamePwd" required={true} fullWidth={true} label="Password"
                  inputRef={register({ required: true })} />

              </FormControl>
            }


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

        <hr />

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


        <hr />

        <h2>Invite people to play!</h2>

        <div className="social-cont">
          <div className="social-share-cont">
            <Share url={shareUrl} options={{ size: "large", hashtags: "rentday", text: getShareTitle() }} />
          </div>
          <div className="social-share-cont">
            <div className="fb-share-button" data-href={shareUrl} data-layout="button" data-size="large">
              <a target="_blank" href="https://www.facebook.com/sharer/sharer.php" className="fb-xfbml-parse-ignore">Share</a>
              </div>
          </div>
        </div>


      </Container>

      {getListOfJoinePlayers()}

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
