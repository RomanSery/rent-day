/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect } from "react";
import { DisplayPlayers } from "./DisplayPlayers";
import { DisplayActions } from "./DisplayActions";
import { SocketService } from "../sockets/SocketService";
import { DisplayResults } from "./DisplayResults";
import { PlayerViewer } from "./PlayerViewer";
import API from '../api';
import { GameContext } from "../../core/types/GameContext";
import { GameEvent } from "../../core/types/GameEvent";
import { areObjectIdsEqual, getGameContextFromLocalStorage, getMyUserId, handleApiError, leaveCurrentGameIfJoined } from "../helpers";
import { SquareViewer } from "./SquareViewer";
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
import { useHistory } from "react-router-dom";
import { useIsMountedRef } from "./useIsMountedRef";
import { TextField } from "@material-ui/core";
import { ChatWindow } from "./ChatWindow";
import Countdown, { CountdownRenderProps, CountdownTimeDelta } from "react-countdown";
import useGameStateStore from "../stores/gameStateStore";

interface Props {
  socketService: SocketService;
}

export const CenterDisplay: React.FC<Props> = ({ socketService }) => {

  const context: GameContext = getGameContextFromLocalStorage();
  const history = useHistory();

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
  const setPlayerToView = useGameStateStore(state => state.setPlayerToView);
  const playerToView = useGameStateStore(state => state.playerToView);
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

  const viewPlayer = (player: Player) => {
    setPlayerToView(player._id);
  };
  const clearPlayer = () => {
    if (gameState && gameState.players) {
      const myUserId = getMyUserId();
      if (myUserId) {
        setPlayerToView(myUserId);
      }

    } else {
      setPlayerToView(undefined);
    }
  };

  const getPlayerToView = (): Player | undefined => {
    if (playerToView && gameState) {
      return gameState.players.find((p: Player) => areObjectIdsEqual(p._id, playerToView));
    }
    if (gameState && gameState.players) {
      const myUserId = getMyUserId();
      if (myUserId) {
        return gameState.players.find((p) => areObjectIdsEqual(p._id, myUserId));
      }
      return undefined;
    }
    return undefined;
  }

  const getGameResultsDisplayComp = () => {
    if (!isMountedRef.current) {
      return null;
    }
    if (gameState?.auctionId) {
      return (<DisplayAuction socketService={socketService} />);
    }
    if (gameState?.lottoId) {
      return (<DisplayLotto socketService={socketService} />);
    }
    return (<DisplayResults socketService={socketService} />);
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
      history.push("/dashboard");
    });
  };

  const isDevEnv = () => {
    return process.env.NODE_ENV === "development";
  }

  const countdownRenderer = (props: CountdownRenderProps) => {
    if (props.minutes > 0) {
      return <div className="countdown-timer">{props.minutes}:{props.seconds}</div>;
    }
    return <div className="countdown-timer">{props.seconds} seconds</div>;
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
          <div className="game-results">
            {getGameResultsDisplayComp()}
          </div>


          {isDevEnv() &&
            <div>
              <TextField label="Die1" type="number" onChange={(e) => setForceDie1(parseInt(e.currentTarget.value))} inputProps={{ min: 1, max: 6 }} name="die1" />
              <TextField label="Die2" type="number" onChange={(e) => setForceDie2(parseInt(e.currentTarget.value))} inputProps={{ min: 1, max: 6 }} name="die2" />
            </div>
          }



          <div className="player-actions">
            <DisplayActions tradeWithPlayer={tradeWithPlayer} onRollAction={onRollDice} onTravelAction={onTravel}
              socketService={socketService}
            />

            {gameState && gameState.settings.useTimers &&
              <Countdown ref={countdownEl} date={gameState?.nextPlayerActBy} renderer={countdownRenderer} onComplete={onCountdownComplete} key={gameState?.nextPlayerActBy} />}
          </div>

          <div className="second-row">
            <div className="player-viewer">
              <PlayerViewer socketService={socketService} getPlayer={getPlayerToView} />
            </div>
            <div className="property-viewer">
              <SquareViewer />
            </div>

          </div>

          <ChatWindow socketService={socketService} />

        </div>

        <DisplayPlayers viewPlayer={viewPlayer} clearPlayer={clearPlayer} />
      </div>

      <GameOverDialog open={showGameOver()} onLeaveGame={onLeaveGame} />
      <TravelDialog socketService={socketService} />
      <OfferTradeDialog socketService={socketService} />
      <ReviewTradeDialog socketService={socketService} />
      <TradeOfferReviewedDialog />

    </React.Fragment>
  );

};
