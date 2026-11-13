import React from "react";
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Button from '@mui/material/Button';
import API from '../api';
import { getGameContextFromLocalStorage, handleApiError } from "../helpers";
import { GameContext } from "../../core/types/GameContext";
import { SocketService } from "../sockets/SocketService";
import { GameEvent } from "../../core/types/GameEvent";
import useGameStateStore from "../stores/gameStateStore";
import { TradePlayer, TradeSummary } from "./TradeSummary";


interface Props {
  socketService: SocketService;
}

/** A trade another player offered you: what you'd get and give, accept or decline. */
export const ReviewTradeDialog: React.FC<Props> = ({ socketService }) => {

  const context: GameContext = getGameContextFromLocalStorage();
  const gameState = useGameStateStore(state => state.data);
  const reviewTradeOpen = useGameStateStore(state => state.reviewTradeOpen);
  const tradeOffer = useGameStateStore(state => state.tradeOffer);
  const setReviewTradeOpen = useGameStateStore(state => state.setReviewTradeOpen);
  const [busy, setBusy] = React.useState(false);

  const respond = (endpoint: "acceptTrade" | "declineTrade") => {
    if (!tradeOffer) {
      return;
    }
    setBusy(true);
    API.post("actions/" + endpoint, { context, tradeId: tradeOffer._id })
      .then(function () {
        if (socketService && gameState) {
          socketService.socket.emit(GameEvent.TRADE_OFFER_REVIEWED, tradeOffer._id);
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameState._id);
        }
        setReviewTradeOpen(false);
      })
      .catch(handleApiError)
      .finally(() => setBusy(false));
  };

  return (
    <Dialog fullWidth={true} maxWidth="sm" aria-labelledby="review-trade-dialog-title" open={reviewTradeOpen}
      onClose={(event, reason) => { if (reason !== "backdropClick" && reason !== "escapeKeyDown") { setReviewTradeOpen(false); } }}>
      <DialogTitle id="review-trade-dialog-title">
        {tradeOffer
          ? <><TradePlayer playerId={tradeOffer.participant1.playerId} fallbackName={tradeOffer.participant1.playerName} /> offers you a trade</>
          : "Trade offer"}
      </DialogTitle>
      <DialogContent>
        {tradeOffer && <TradeSummary participant1={tradeOffer.participant1} participant2={tradeOffer.participant2} />}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => respond("declineTrade")} color="inherit" disabled={busy}>Decline</Button>
        <Button onClick={() => respond("acceptTrade")} variant="contained" color="success" disabled={busy}>Accept trade</Button>
      </DialogActions>
    </Dialog>
  );

};
