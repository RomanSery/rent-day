/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect } from "react";
import { DisplayPlayers } from "./DisplayPlayers";
import { DisplayActions } from "./DisplayActions";
import { SocketService } from "../sockets/SocketService";
import { DisplayResults } from "./DisplayResults";
import { InfoCard } from "./InfoCard";
import API from '../api';
import { GameContext } from "../../core/types/GameContext";
import { GameEvent } from "../../core/types/GameEvent";
import { areObjectIdsEqual, getGameContextFromLocalStorage, getMyUserId, handleApiError, leaveCurrentGameIfJoined } from "../helpers";
import { Player } from "../../core/types/Player";
import { DisplayAuction } from "./DisplayAuction";
import { DisplayLotto } from "./DisplayLotto";
import { OfferTradeDialog } from "../dialogs/OfferTradeDialog";
import { TradeOffer } from "../../core/types/TradeOffer";
import { ReviewTradeDialog } from "../dialogs/ReviewTradeDialog";
import { TradeOfferReviewedDialog } from "../dialogs/TradeOfferReviewedDialog";
import { TravelDialog } from "../dialogs/TravelDialog";
import { GameOverDialog } from "../dialogs/GameOverDialog";
import { GameStatus } from "../../core/enums/GameStatus";
import { useNavigate } from "react-router-dom";
import { useIsMountedRef } from "./useIsMountedRef";
import { TextField } from "@mui/material";
import { ChatWindow } from "./ChatWindow";
import Countdown, { CountdownRenderProps, CountdownTimeDelta } from "react-countdown";
import useGameStateStore from "../stores/gameStateStore";

interface Props {
  socketService: SocketService;
}

export const CenterDisplay: React.FC<Props> = ({ socketService }) => {

  const context: GameContext = getGameContextFromLocalStorage();
  const navigate = useNavigate();

  const countdownEl = React.useRef<Countdown | null>(null);
  const isMountedRef = useIsMountedRef();

  const gameState = useGameStateStore(state => state.data);
  const setTradeOffer = useGameStateStore(state => state.setTradeOffer);
  const setReviewTradeOpen = useGameStateStore(state => state.setReviewTradeOpen);
  const setTradeReviewedOpen = useGameStateStore(state => state.setTradeReviewedOpen);
  const forceDie1 = useGameStateStore(state => state.forceDie1);
  const forceDie2 = useGameStateStore(state => state.forceDie2);
  const setForceDie1 = useGameStateStore(state => state.setForceDie1);
  const setForceDie2 = useGameStateStore(state => state.setForceDie2);
  const setTravelOpen = useGameStateStore(state => state.setTravelOpen);
  const setOfferTradeOpen = useGameStateStore(state => state.setOfferTradeOpen);
  const setTradingWithPlayerId = useGameStateStore(state => state.setTradingWithPlayerId);


  useEffect(() => {

    socketService.listenForEvent(GameEvent.SEND_TRADE_OFFER, (data: TradeOffer) => {
      if (areObjectIdsEqual(data.participant2.playerId, getMyUserId())) {
        setTradeOffer(data);
        setReviewTradeOpen(true);
      }
    });


    socketService.listenForEvent(GameEvent.STOP_ANIMATE_DICE, (gameId: any) => {
      setTimeout(() => {
        if (countdownEl.current) {
          countdownEl.current.start();
        }
      }, 5000);
    });


    socketService.listenForEvent(GameEvent.UPDATE_GAME_STATE, (gameId: any, completedTurn?: boolean) => {
      if (completedTurn) {
        if (countdownEl.current) {
          countdownEl.current.stop();
        }
      }
    });

    socketService.listenForEvent(GameEvent.TRADE_OFFER_REVIEWED, (data: TradeOffer) => {
      setTradeOffer(data);
      setTradeReviewedOpen(true);
    });
  }, []);

  const onRollDice = async () => {

    if (socketService && gameState) {
      socketService.socket.emit(GameEvent.ROLL_DICE, gameState._id);
    }


    setTimeout(() => {

      API.post("actions/roll", { context, forceDie1: forceDie1, forceDie2: forceDie2 })
        .then(function (response) {
          if (socketService && gameState) {
            if (response.data.needToAnimate) {
              socketService.socket.emit(GameEvent.STOP_ANIMATE_DICE, gameState._id, response.data.playerId, response.data.diceRoll, response.data.frames);
            } else {
              socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameState._id);
            }
          }
        })
        .catch(handleApiError);
    }, 1500);

  };

  const onTravel = async () => {
    setTravelOpen(true);

  };

  /** auctions and the lotto need room, so they get a panel under the turn bar */
  const getStageComp = () => {
    if (!isMountedRef.current) {
      return null;
    }
    if (gameState?.auctionId) {
      return (<DisplayAuction socketService={socketService} />);
    }
    if (gameState?.lottoId) {
      return (<DisplayLotto socketService={socketService} />);
    }
    return null;
  }

  const tradeWithPlayer = (player: Player) => {
    setTradingWithPlayerId(player._id);
    setOfferTradeOpen(true);
  };



  const showGameOver = () => {
    return gameState && gameState.status === GameStatus.FINISHED ? true : false;
  }

  const onLeaveGame = () => {
    leaveCurrentGameIfJoined(socketService, () => {
      navigate("/dashboard");
    });
  };

  // Dev-only boxes to force the next roll (the server ignores them outside
  // development). Hidden for now; set to true to bring them back in dev builds.
  const SHOW_DEV_DICE = false;
  const showDevDice = () => {
    return SHOW_DEV_DICE && import.meta.env.DEV;
  }

  // The server doesn't send the turn length, so the timer bar measures from
  // whatever was left when this deadline first arrived (a full turn, normally).
  const actBy = gameState?.nextPlayerActBy;
  const turnTotalMs = React.useMemo(
    () => (actBy ? Math.max(1000, Date.parse(actBy) - Date.now()) : 1),
    [actBy]
  );

  const countdownRenderer = (props: CountdownRenderProps) => {
    const pct = Math.max(0, Math.min(100, (props.total / turnTotalMs) * 100));
    const low = props.total <= 10000;
    return (
      <div className={"turn-timer" + (low ? " low" : "")} title="Time left this turn">
        <div className="turn-timer-track"><div className="turn-timer-fill" style={{ width: pct + "%" }} /></div>
        <span className="turn-timer-text">{props.minutes}:{String(props.seconds).padStart(2, "0")}</span>
      </div>
    );
  };

  const onCountdownComplete = (timeDelta: CountdownTimeDelta) => {
    if (!gameState) {
      return;
    }
    const playerToAct = gameState.players.find((p: Player) => areObjectIdsEqual(p._id, gameState.nextPlayerToAct));
    if (playerToAct && !playerToAct.hasRolled) {
      socketService.socket.emit(GameEvent.ROLL_DICE, gameState._id);
    }

    setTimeout(() => {

      API.post("actions/timesUpAction", { context })
        .then(function (response) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameState._id);
        })
        .catch(handleApiError);
    }, 1500);
  };

  return (
    <React.Fragment>
      <div className="center-square square">
        <div className="center-left-side">

          {/* turn bar: dice and what happened, the buttons, and the turn timer.
              DisplayResults stays mounted through auctions so its socket
              listeners are registered once. */}
          <div className="turn-bar">
            <div className="game-results">
              <DisplayResults socketService={socketService} />
            </div>

            <div className="player-actions">
              <DisplayActions tradeWithPlayer={tradeWithPlayer} onRollAction={onRollDice} onTravelAction={onTravel}
                socketService={socketService}
              />
            </div>

            {gameState && gameState.settings.useTimers &&
              <Countdown ref={countdownEl} date={gameState?.nextPlayerActBy} renderer={countdownRenderer} onComplete={onCountdownComplete} key={gameState?.nextPlayerActBy} />}
          </div>

          {showDevDice() &&
            <div className="dev-dice">
              <TextField size="small" label="Die1" type="number" onChange={(e) => setForceDie1(parseInt(e.currentTarget.value))} slotProps={{ htmlInput: { min: 1, max: 6 } }} name="die1" />
              <TextField size="small" label="Die2" type="number" onChange={(e) => setForceDie2(parseInt(e.currentTarget.value))} slotProps={{ htmlInput: { min: 1, max: 6 } }} name="die2" />
            </div>
          }

          {(gameState?.auctionId || gameState?.lottoId) &&
            <div className="turn-stage">
              {getStageComp()}
            </div>
          }

          <InfoCard />

          <ChatWindow socketService={socketService} />

        </div>

        <DisplayPlayers />
      </div>

      <GameOverDialog open={showGameOver()} onLeaveGame={onLeaveGame} />
      <TravelDialog socketService={socketService} />
      <OfferTradeDialog socketService={socketService} />
      <ReviewTradeDialog socketService={socketService} />
      <TradeOfferReviewedDialog />

    </React.Fragment>
  );

};
