import React from "react";
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Button from '@mui/material/Button';
import { areObjectIdsEqual, getMyUserId } from "../helpers";
import { TradeStatus } from "../../core/enums/TradeStatus";
import useGameStateStore from "../stores/gameStateStore";
import { TradePlayer, TradeSummary } from "./TradeSummary";

/** The outcome of a trade, shown to everyone at the table. */
export const TradeOfferReviewedDialog: React.FC = () => {

  const tradeOffer = useGameStateStore(state => state.tradeOffer);
  const tradeReviewedOpen = useGameStateStore(state => state.tradeReviewedOpen);
  const setTradeReviewedOpen = useGameStateStore(state => state.setTradeReviewedOpen);

  if (!tradeOffer) {
    return null;
  }

  const accepted = tradeOffer.status === TradeStatus.ACCEPTED;
  const verb = accepted ? "accepted" : "declined";
  const myId = getMyUserId();
  const p1 = <TradePlayer playerId={tradeOffer.participant1.playerId} fallbackName={tradeOffer.participant1.playerName} />;
  const p2 = <TradePlayer playerId={tradeOffer.participant2.playerId} fallbackName={tradeOffer.participant2.playerName} />;

  const outcome = areObjectIdsEqual(tradeOffer.participant1.playerId, myId)
    ? <>{p2} {verb} your offer.</>
    : areObjectIdsEqual(tradeOffer.participant2.playerId, myId)
      ? <>You {verb} {p1}'s offer.</>
      : <>{p2} {verb} {p1}'s offer.</>;

  return (
    <Dialog fullWidth={true} maxWidth="sm" onClose={() => setTradeReviewedOpen(false)} aria-labelledby="reviewed-trade-dialog-title" open={tradeReviewedOpen}>
      <DialogTitle id="reviewed-trade-dialog-title">{accepted ? "Trade accepted" : "Trade declined"}</DialogTitle>
      <DialogContent>
        <p className={"trade-outcome " + (accepted ? "accepted" : "declined")}>{outcome}</p>
        <TradeSummary participant1={tradeOffer.participant1} participant2={tradeOffer.participant2} />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setTradeReviewedOpen(false)} color="primary">Close</Button>
      </DialogActions>
    </Dialog>
  );

};
