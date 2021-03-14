/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import { DisplayPlayers } from "./DisplayPlayers";
import { GameState } from "../../core/types/GameState";
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
import { TextField } from "@material-ui/core";
import { OfferTradeDialog } from "../dialogs/OfferTradeDialog";
import { TradeOffer } from "../../core/types/TradeOffer";
import { ReviewTradeDialog } from "../dialogs/ReviewTradeDialog";
import { TradeOfferReviewedDialog } from "../dialogs/TradeOfferReviewedDialog";
import { TravelDialog } from "../dialogs/TravelDialog";
import { GameOverDialog } from "../dialogs/GameOverDialog";
import { GameStatus } from "../../core/enums/GameStatus";
import { useHistory } from "react-router-dom";
import { useIsMountedRef } from "./useIsMountedRef";

interface Props {
  gameInfo: GameState | undefined;
  socketService: SocketService;
  getPing: (userId: string | undefined) => string;
  getSquareId: () => number | undefined;
  showMovementAnimation: (playerId: string, frames: Array<number>) => void;
}

export const CenterDisplay: React.FC<Props> = ({ gameInfo, socketService, getPing, getSquareId, showMovementAnimation }) => {

  const context: GameContext = getGameContextFromLocalStorage();
  const history = useHistory();

  const [playerToView, setPlayerToView] = useState<String | undefined>(undefined);

  const [forceDie1, setForceDie1] = useState<number | undefined>(undefined);
  const [forceDie2, setForceDie2] = useState<number | undefined>(undefined);

  const [offerTradeOpen, setOfferTradeOpen] = useState(false);
  const [reviewTradeOpen, setReviewTradeOpen] = useState(false);
  const [tradeReviewedOpen, setTradeReviewedOpen] = useState(false);
  const [travelOpen, setTravelOpen] = useState(false);

  const [tradingWithPlayerId, setTradingWithPlayerId] = useState<string | null>(null);
  const [tradeOffer, setTradeOffer] = useState<TradeOffer | null>(null);

  const isMountedRef = useIsMountedRef();

  useEffect(() => {

    socketService.listenForEvent(GameEvent.SEND_TRADE_OFFER, (data: TradeOffer) => {
      if (areObjectIdsEqual(data.participant2.playerId, getMyUserId())) {
        setTradeOffer(data);
        setReviewTradeOpen(true);
      }
    });

    socketService.listenForEvent(GameEvent.TRADE_OFFER_REVIEWED, (data: TradeOffer) => {
      setTradeOffer(data);
      setTradeReviewedOpen(true);
    });
  }, []);

  const onRollDice = async () => {

    if (socketService && gameInfo) {
      socketService.socket.emit(GameEvent.ROLL_DICE, gameInfo._id);
    }

    setTimeout(() => {
      API.post("actions/roll", { context, forceDie1: forceDie1, forceDie2: forceDie2 })
        .then(function (response) {
          if (socketService && gameInfo) {
            if (response.data.needToAnimate) {
              socketService.socket.emit(GameEvent.STOP_ANIMATE_DICE, gameInfo._id, response.data.playerId, response.data.diceRoll, response.data.frames);
            } else {
              socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameInfo._id);
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
    if (gameInfo && gameInfo.players) {
      const myUserId = getMyUserId();
      if (myUserId) {
        setPlayerToView(myUserId);
      }

    } else {
      setPlayerToView(undefined);
    }
  };

  const getPlayerToView = (): Player | undefined => {
    if (playerToView && gameInfo) {
      return gameInfo.players.find((p: Player) => areObjectIdsEqual(p._id, playerToView));
    }
    if (gameInfo && gameInfo.players) {
      const myUserId = getMyUserId();
      if (myUserId) {
        return gameInfo.players.find((p) => areObjectIdsEqual(p._id, myUserId));
      }
      return undefined;
    }
    return undefined;
  }

  const getGameResultsDisplayComp = () => {
    if (!isMountedRef.current) {
      return null;
    }
    if (gameInfo?.auctionId) {
      return (<DisplayAuction gameInfo={gameInfo} socketService={socketService} />);
    }
    if (gameInfo?.lottoId) {
      return (<DisplayLotto gameInfo={gameInfo} socketService={socketService} />);
    }
    return (<DisplayResults gameInfo={gameInfo} socketService={socketService} showMovementAnimation={showMovementAnimation} />);
  }

  const tradeWithPlayer = (player: Player) => {
    setTradingWithPlayerId(player._id);
    setOfferTradeOpen(true);
  };

  const onCancelTravel = () => {
    setTravelOpen(false);
  };

  const showGameOver = () => {
    return gameInfo && gameInfo.status === GameStatus.FINISHED ? true : false;
  }

  const onLeaveGame = () => {
    leaveCurrentGameIfJoined(() => {
      history.push("/dashboard");
    });
  };

  return (
    <React.Fragment>
      <div className="center-square square">
        <div className="center-left-side">
          <div className="game-results">
            {getGameResultsDisplayComp()}
          </div>

          <div>
            <TextField label="Die1" type="number" onChange={(e) => setForceDie1(parseInt(e.currentTarget.value))} inputProps={{ min: 1, max: 6 }} name="die1" />
            <TextField label="Die2" type="number" onChange={(e) => setForceDie2(parseInt(e.currentTarget.value))} inputProps={{ min: 1, max: 6 }} name="die2" />
          </div>

          <div className="player-actions">
            <DisplayActions tradeWithPlayer={tradeWithPlayer} gameInfo={gameInfo} onRollAction={onRollDice} onTravelAction={onTravel} socketService={socketService}
            />
          </div>

          <div className="second-row">
            <div className="player-viewer">
              <PlayerViewer socketService={socketService} gameInfo={gameInfo} getPlayer={getPlayerToView} />
            </div>
            <div className="property-viewer">
              <SquareViewer gameInfo={gameInfo} getSquareId={getSquareId} socketService={socketService} />
            </div>

          </div>

        </div>

        <DisplayPlayers gameInfo={gameInfo} getPing={getPing} viewPlayer={viewPlayer} clearPlayer={clearPlayer} />
      </div>

      <GameOverDialog gameInfo={gameInfo} open={showGameOver()} onLeaveGame={onLeaveGame} />
      <TravelDialog socketService={socketService} gameInfo={gameInfo} open={travelOpen} onClose={() => setTravelOpen(false)} onCancel={onCancelTravel} />
      <OfferTradeDialog socketService={socketService} gameInfo={gameInfo} open={offerTradeOpen} onClose={() => setOfferTradeOpen(false)} tradingWithPlayerId={tradingWithPlayerId} />
      <ReviewTradeDialog socketService={socketService} gameInfo={gameInfo} open={reviewTradeOpen} onClose={() => setReviewTradeOpen(false)} tradeOffer={tradeOffer} />
      <TradeOfferReviewedDialog gameInfo={gameInfo} open={tradeReviewedOpen} onClose={() => setTradeReviewedOpen(false)} tradeOffer={tradeOffer} />

    </React.Fragment>
  );

};
