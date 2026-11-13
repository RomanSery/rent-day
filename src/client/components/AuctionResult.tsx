import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGavel, faXmark } from "@fortawesome/free-solid-svg-icons";
import useGameStateStore from "../stores/gameStateStore";
import { areObjectIdsEqual, dollarFormatter, getMyUserId } from "../helpers";

/**
 * How the last auction ended: who won, what they paid and every bid. It stays
 * through the rest of that turn and the whole next turn (or until closed), so
 * nobody misses it when the auction panel closes.
 */
export const AuctionResult: React.FC = () => {
  const gameState = useGameStateStore((state) => state.data);
  const [closedId, setClosedId] = useState<string | null>(null);

  const result = gameState?.lastAuction;
  if (!gameState || !result || gameState.auctionId || gameState.lottoId) {
    return null;
  }
  if (closedId === result.auctionId || (gameState.turnNumber ?? 0) - result.turn > 1) {
    return null;
  }

  const squareName = gameState.theme?.[result.squareId]?.name ?? "the property";
  const me = getMyUserId();
  const winnerBid = result.bids.find((b) => result.winnerId && areObjectIdsEqual(b.playerId, result.winnerId));
  const iWon = !!winnerBid && areObjectIdsEqual(winnerBid.playerId, me);

  const headline = () => {
    if (result.isTie || !winnerBid) {
      const top = result.bids[0]?.bid ?? 0;
      return <>Nobody won {squareName}: the top bids tied at <b>{dollarFormatter.format(top)}</b>.</>;
    }
    return (
      <>
        {iWon ? <b>You</b> : <b style={{ color: winnerBid.color }}>{winnerBid.name}</b>} won {squareName} for{" "}
        <b>{dollarFormatter.format(result.price)}</b>.
      </>
    );
  };

  const detail = () => {
    if (result.isTie || !winnerBid) {
      return "In a tie nobody wins and the property stays unowned.";
    }
    if (result.price < winnerBid.bid) {
      return (iWon ? "You" : "They") + " bid " + dollarFormatter.format(winnerBid.bid) + " and paid the second-highest bid.";
    }
    return "Nobody else bid, so " + (iWon ? "you" : "they") + " paid " + (iWon ? "your" : "their") + " own bid.";
  };

  return (
    <section className="turn-stage auction-result" aria-label="Auction result">
      <div className="auction-result-head">
        <span className="auction-result-title"><FontAwesomeIcon icon={faGavel} /> Auction result</span>
        <button type="button" className="auction-result-close" aria-label="Close auction result" onClick={() => setClosedId(result.auctionId)}>
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>
      <p className="auction-result-headline">{headline()}</p>
      <p className="auction-result-detail">{detail()}</p>
      <ul className="auction-result-bids">
        {result.bids.map((b) => {
          const won = !!result.winnerId && areObjectIdsEqual(b.playerId, result.winnerId);
          return (
            <li key={b.playerId} className={won ? "won" : undefined}>
              <span className="dot" style={{ background: b.color }} />
              <span className="name">{areObjectIdsEqual(b.playerId, me) ? b.name + " (you)" : b.name}</span>
              {won && <span className="chip">Winner</span>}
              <span className="amount">{b.noBid ? "No bid" : dollarFormatter.format(b.bid)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
