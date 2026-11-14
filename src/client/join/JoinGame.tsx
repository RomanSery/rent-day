import React, { useEffect, useState } from "react";

import { useNavigate, useLocation } from "react-router-dom";
import { GameState } from "../../core/types/GameState";
import { areObjectIdsEqual, dollarFormatter, getIconProp, getMyUserId, getObjectIdAsHexString, handleApiError, leaveCurrentGameIfJoined, setJoinedGameStorage } from "../helpers";
import { GameStatus } from "../../core/enums/GameStatus";
import API from '../api';
import { Player } from "../../core/types/Player";
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import { PieceType } from "../../core/enums/PieceType";
import { SocketService } from "../sockets/SocketService";
import { GameEvent } from "../../core/types/GameEvent";
import {
  Alert, Box, Button, Chip, CircularProgress, FormHelperText, Paper, Snackbar, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography
} from "@mui/material";
import { JoinedGameMsg } from "../../core/types/messages";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers, faCoins, faLock, faRobot, faLink, faCheck, faChair } from "@fortawesome/free-solid-svg-icons";
import { PlayerClass } from "../../core/enums/PlayerClass";
import { corruptionAdjustment, luckAdjustment, negotiationAdjustment } from "../../core/constants";
import { getPlayerClassDescription } from "../uiHelpers";
import queryString from "query-string";
import { useQuery } from "@tanstack/react-query";
import { Share } from "react-twitter-widgets";

interface Props {
  socketService: SocketService;
}

type Inputs = {
  piece: PieceType | "";
  playerClass: PlayerClass | "";
  gamePwd: string | null;
};

const PIECES: PieceType[] = [PieceType.Pawn, PieceType.Hat, PieceType.Car, PieceType.Bicycle, PieceType.Cat, PieceType.Dog];
const CLASSES: PlayerClass[] = [PlayerClass.Banker, PlayerClass.Conductor, PlayerClass.Gambler, PlayerClass.Governor];

/** Piece and class pickers: make the chosen button unmistakable. */
const pickedSx = {
  "&.Mui-selected, &.Mui-selected:hover": { bgcolor: "primary.main", color: "primary.contrastText" },
} as const;

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.5, display: "block", textAlign: "left" }}>
    {children}
  </Typography>
);

/**
 * One row in the list of seats: a joined player, or an open seat. Drawn in
 * neutral ink: player colours are only handed out when the game starts, so
 * in the lobby every player still has the same placeholder colour.
 */
const Seat: React.FC<{ player?: Player; isMe?: boolean }> = ({ player, isMe }) => (
  <Stack direction="row" spacing={1.5} className="lobby-seat"
    sx={{
      alignItems: "center", px: 1.5, py: 1, borderRadius: 1, minHeight: 52,
      border: "1px solid", borderColor: isMe ? "primary.main" : (player ? "divider" : "transparent"),
      bgcolor: player ? "background.paper" : "action.hover",
    }}>
    <Box sx={{ width: 28, textAlign: "center", flexShrink: 0 }}>
      <FontAwesomeIcon icon={player ? getIconProp(player.type) : faChair} size="lg"
        color={player ? "#37474f" : "#9e9e9e"} />
    </Box>
    {player ?
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 600, lineHeight: 1.3 }}>
          {player.name}{isMe ? " (you)" : ""}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.3 }}>
          {player.playerClass}{player.isBot ? " · computer" : ""}
        </Typography>
      </Box>
      :
      <Typography color="text.secondary" sx={{ flex: 1 }}>Open seat</Typography>
    }
    {player?.isBot && <FontAwesomeIcon icon={faRobot} color="#757575" title="Computer player" />}
  </Stack>
);

export const JoinGame: React.FC<Props> = ({ socketService }) => {

  const navigate = useNavigate();
  const location = useLocation();

  const getGameIdFromUrl = () => {
    const parsed = queryString.parse(location.search);
    return parsed.gid as string;
  };

  const gameToJoinId: string | null = getGameIdFromUrl();

  const [snackOpen, setSnackOpen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [snackMsg, setSnackMsg] = useState<string>("");
  const [botLevel, setBotLevel] = useState<string>("Normal");
  const [addingBot, setAddingBot] = useState<boolean>(false);

  const { register, control, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<Inputs>({
    defaultValues: { piece: "", playerClass: "", gamePwd: null },
  });
  const selectedPlayerClass = watch("playerClass");

  const gameInfoQuery = useQuery<GameState, Error>({
    queryKey: ["getGame", gameToJoinId],
    queryFn: () => API.post("getGame", { gameId: gameToJoinId }).then(function (response) { return response.data.game; }),
  });
  const game = gameInfoQuery.data;

  // react-hook-form 7: wire register() into MUI inputs via inputRef
  const { ref: pwdRef, ...pwdRest } = register("gamePwd", { required: !!game?.settings.password });
  const pwdField = { inputRef: pwdRef, ...pwdRest };


  useEffect(() => {
    const off: Array<() => void> = [];

    off.push(socketService.listenForEvent(GameEvent.JOINED_GAME, (data: JoinedGameMsg) => {
      if (data.allJoined) {
        navigate("/gameinstance");
      } else {
        gameInfoQuery.refetch();
        setSnackMsg(data.playerName + " has joined");
        setSnackOpen(true);
      }
    }));

    off.push(socketService.listenForEvent(GameEvent.LEAVE_GAME, (data: any, game: GameState) => {
      setSnackMsg(data);
      setSnackOpen(true);
      gameInfoQuery.refetch();
    }));

    // sent on (re)connect so a returning player sees who has joined meanwhile
    off.push(socketService.listenForEvent(GameEvent.UPDATE_GAME_STATE, (game: GameState) => {
      if (game && game.status === GameStatus.ACTIVE) {
        navigate("/gameinstance");
      } else {
        gameInfoQuery.refetch();
      }
    }));


    return function cleanup() {
      off.forEach((stop) => stop());
      if (socketService) {
        socketService.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "/js/fb_share.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    }
  }, []);


  const onJoinGame: SubmitHandler<Inputs> = (data) => {

    return API.post("joinGame", { gameId: gameToJoinId, piece: data.piece, playerClass: data.playerClass, gamePwd: data.gamePwd })
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
          navigate("/gameinstance");
        }
      })
      .catch(handleApiError);

  };

  const onAddBot = () => {
    setAddingBot(true);
    API.post("addBot", { gameId: gameToJoinId, level: botLevel })
      .then(function (response) {
        gameInfoQuery.refetch();
        if (response.data.allJoined) {
          navigate("/gameinstance");
        }
      })
      .catch(handleApiError)
      .finally(() => setAddingBot(false));
  };

  const onLeaveGame = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.preventDefault();

    leaveCurrentGameIfJoined(socketService, () => {
      navigate("/dashboard");
    });
  };

  const closeSnack = (event: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }

    setSnackOpen(false);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // older browsers, or a page without clipboard permission
      const el = document.createElement("input");
      el.value = window.location.href;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const shareUrl = window.location.href;
  const shareTitle = "Think you can be a Block Baron? Let's play!";

  if (gameInfoQuery.isError) {
    return (
      <Paper elevation={2} sx={{ my: 1, p: 2.5 }}>
        <Alert severity="error">{gameInfoQuery.error.message}</Alert>
        <Button fullWidth sx={{ mt: 1.5 }} onClick={() => navigate("/dashboard")}>Back</Button>
      </Paper>
    );
  }

  if (!game) {
    return (
      <Paper elevation={2} sx={{ my: 1, p: 2.5 }}>
        <Typography color="text.secondary">Loading game…</Typography>
      </Paper>
    );
  }

  const myUserId = getMyUserId();
  // seated at this table (session storage only says this tab is in *some* game)
  const joined = game.players.some((p) => areObjectIdsEqual(p._id, myUserId));
  const openSeats = Math.max(0, game.settings.maxPlayers - game.players.length);
  const takenPieces = new Set(game.players.map((p) => p.type));
  const isCreator = game.status === GameStatus.JOINING && areObjectIdsEqual(game.createdBy, myUserId);
  // until the creator joins, one open seat stays theirs (bots can't fill it,
  // or the game would start without them); the server enforces the same rule
  const seatsForBots = openSeats - (joined ? 0 : 1);
  const canAddBot = isCreator && seatsForBots > 0;
  const lastSeatIsYours = isCreator && !joined && openSeats === 1;

  return (
    <React.Fragment>
      <Paper elevation={2} className="lobby" sx={{ my: 1, p: { xs: 1.5, sm: 2.5 }, textAlign: "left" }}>
        {/* name and chips: stacked and centred on narrow screens, one row on wide ones */}
        <Box sx={{
          display: "flex", flexDirection: { xs: "column", md: "row" }, alignItems: "center",
          justifyContent: "space-between", gap: 1,
          pb: 1.5, mb: 1.5, borderBottom: 1, borderColor: "divider",
        }}>
          <Typography component="h2" variant="h5">{game.name}</Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", justifyContent: "center" }}>
            <Chip size="small" variant="outlined" icon={<FontAwesomeIcon icon={faUsers} />}
              label={`${game.players.length} of ${game.settings.maxPlayers} seats taken`} />
            <Chip size="small" variant="outlined" icon={<FontAwesomeIcon icon={faCoins} />}
              label={`${dollarFormatter.format(game.settings.initialMoney)} each`} />
            {game.settings.password &&
              <Chip size="small" variant="outlined" icon={<FontAwesomeIcon icon={faLock} />} label="Password" />}
          </Stack>
        </Box>

        {/* One column on narrow screens. From md up, the join form gets its
            own column on the right so a wide, short window needs no scrolling. */}
        <Box sx={{
          display: "grid", columnGap: 3, alignContent: "start",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gridTemplateRows: { md: "auto auto 1fr" },
          gridTemplateAreas: {
            xs: `"table" "join" "invite" "skills"`,
            md: `"table join" "invite join" "skills join"`,
          },
        }}>

          <Stack spacing={1.5} sx={{ gridArea: "table", pb: 1.5 }}>
            <SectionTitle>At the table</SectionTitle>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
              {game.players.map((p) => (
                <Seat key={getObjectIdAsHexString(p._id)} player={p} isMe={areObjectIdsEqual(p._id, myUserId)} />
              ))}
              {Array.from({ length: openSeats }).map((_, i) => <Seat key={"open-" + i} />)}
            </Box>

            {canAddBot &&
              <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                <TextField size="small" select label="Computer skill" id="bot-level" value={botLevel}
                  onChange={(e) => setBotLevel(e.target.value)} sx={{ minWidth: 130 }}
                  slotProps={{ select: { native: true } }}>
                  <option value="Normal">Normal</option>
                  <option value="Easy">Easy</option>
                </TextField>
                <Button variant="outlined" onClick={onAddBot} disabled={addingBot}
                  startIcon={addingBot ? <CircularProgress size={14} color="inherit" /> : <FontAwesomeIcon icon={faRobot} />}
                  sx={{ flex: 1, height: 40 }}>
                  Add computer player
                </Button>
              </Stack>
            }
            {lastSeatIsYours &&
              <Typography variant="body2" color="text.secondary">
                The last open seat is kept for you. Join the game to start it.
              </Typography>
            }
          </Stack>

          <Box sx={{
            gridArea: "join", pb: 1.5, borderColor: "divider",
            borderTop: { xs: 1, md: 0 }, pt: { xs: 1.5, md: 0 },
            borderLeft: { xs: 0, md: 1 }, pl: { md: 3 },
            }}>
            {!joined &&
              <form onSubmit={handleSubmit(onJoinGame)} noValidate>
                <Stack spacing={1.5}>
                  <SectionTitle>Join this game</SectionTitle>

                  <Box>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>Piece</Typography>
                    <Controller name="piece" control={control} rules={{ required: true }}
                      render={({ field }) => (
                        <ToggleButtonGroup exclusive fullWidth size="small" aria-label="Piece"
                          value={field.value || null}
                          onChange={(_e, v) => { if (v) field.onChange(v); }}>
                          {PIECES.map((piece) => (
                            <ToggleButton key={piece} value={piece} aria-label={piece} title={takenPieces.has(piece) ? piece + " (taken)" : piece}
                              disabled={takenPieces.has(piece)} sx={{ py: 1, ...pickedSx }}>
                              <FontAwesomeIcon icon={getIconProp(piece)} size="lg" />
                            </ToggleButton>
                          ))}
                        </ToggleButtonGroup>
                      )} />
                    {errors.piece && <FormHelperText error>Pick a piece</FormHelperText>}
                  </Box>

                  <Box>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>Class</Typography>
                    <Controller name="playerClass" control={control} rules={{ required: true }}
                      render={({ field }) => (
                        <ToggleButtonGroup exclusive fullWidth size="small" aria-label="Class"
                          value={field.value || null}
                          onChange={(_e, v) => { if (v) field.onChange(v); }}
                          sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)", md: "1fr 1fr", lg: "repeat(4, 1fr)" } }}>
                          {CLASSES.map((c) => (
                            <ToggleButton key={c} value={c} sx={{ textTransform: "none", fontWeight: 600, ...pickedSx }}>{c}</ToggleButton>
                          ))}
                        </ToggleButtonGroup>
                      )} />
                    {errors.playerClass && <FormHelperText error>Pick a class</FormHelperText>}
                  </Box>

                  {selectedPlayerClass &&
                    <Box className="player-class-description" sx={{ bgcolor: "action.hover", borderRadius: 1, px: 1 }}>
                      {getPlayerClassDescription(selectedPlayerClass)}
                    </Box>
                  }

                  {game.settings.password &&
                    <TextField size="small" id="gamePwd" required fullWidth label="Game password"
                      error={!!errors.gamePwd} helperText={errors.gamePwd ? "Password is required" : undefined}
                      {...pwdField} />
                  }

                  <Button variant="contained" color="primary" type="submit" fullWidth size="large" disabled={isSubmitting}>
                    Join game
                  </Button>
                </Stack>
              </form>
            }

            {joined &&
              <Stack spacing={1.5}>
                <Alert severity="success" icon={<FontAwesomeIcon icon={faCheck} />}>
                  You're in. The game starts when {openSeats === 1 ? "the last seat is" : `all ${openSeats} open seats are`} filled.
                </Alert>
                <Button variant="outlined" color="secondary" onClick={onLeaveGame} fullWidth>
                  Leave game
                </Button>
              </Stack>
            }
          </Box>

          <Stack spacing={1.5} sx={{ gridArea: "invite", py: 1.5, borderTop: 1, borderColor: "divider" }}>
            <SectionTitle>Invite friends</SectionTitle>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
              <Button variant="outlined" onClick={copyLink}
                startIcon={<FontAwesomeIcon icon={copied ? faCheck : faLink} />}>
                {copied ? "Link copied" : "Copy invite link"}
              </Button>
              <div className="social-share-cont">
                <Share url={shareUrl} options={{ size: "large", hashtags: "blockbarons", text: shareTitle }} />
              </div>
              <div className="social-share-cont">
                <div id="fb-share-button">
                  <svg viewBox="0 0 12 12" preserveAspectRatio="xMidYMid meet">
                    <path className="svg-icon-path" d="M9.1,0.1V2H8C7.6,2,7.3,2.1,7.1,2.3C7,2.4,6.9,2.7,6.9,3v1.4H9L8.8,6.5H6.9V12H4.7V6.5H2.9V4.4h1.8V2.8 c0-0.9,0.3-1.6,0.7-2.1C6,0.2,6.6,0,7.5,0C8.2,0,8.7,0,9.1,0.1z"></path>
                  </svg>
                  <span>Share</span>
                </div>
              </div>
            </Stack>
          </Stack>

          <Stack spacing={1} sx={{ gridArea: "skills", pt: 1.5, borderTop: 1, borderColor: "divider" }}>
            <SectionTitle>How skills work</SectionTitle>
            <Box component="dl" className="lobby-skills" sx={{ m: 0, display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 2, rowGap: 0.5 }}>
              <dt>Luck</dt>
              <dd>Each point <b>raises</b> your chance to win lotto prizes by <b>{luckAdjustment}%</b></dd>
              <dt>Negotiation</dt>
              <dd>Each point <b>lowers</b> the rent you pay by <b>{negotiationAdjustment}%</b></dd>
              <dt>Corruption</dt>
              <dd>Each point <b>lowers</b> your taxes per turn by <b>{corruptionAdjustment}%</b></dd>
            </Box>
          </Stack>

        </Box>
      </Paper>

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
