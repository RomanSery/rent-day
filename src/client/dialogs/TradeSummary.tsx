import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowDown, faArrowUp, faCoins, faLightbulb, faTrain } from "@fortawesome/free-solid-svg-icons";
import { SquareConfigDataMap, squareGroupColorMap } from "../../core/config/SquareData";
import { SquareType } from "../../core/enums/SquareType";
import { TradeParticipant } from "../../core/types/TradeParticipant";
import { Player } from "../../core/types/Player";
import { areObjectIdsEqual, dollarFormatter, getIconProp, getMyUserId } from "../helpers";
import { getSquareTxt } from "../squares/squareHelpers";
import useGameStateStore from "../stores/gameStateStore";

/** A square in a trade: its group colour (or a station/utility icon) and name. */
export const TradeSquare: React.FC<{ squareId: number }> = ({ squareId }) => {
  const gameState = useGameStateStore(state => state.data);
  const config = SquareConfigDataMap.get(squareId);
  const data = gameState?.squareState.find((s) => s.squareId === squareId);
  const colorClass = config?.groupId ? squareGroupColorMap.get(config.groupId) : undefined;
  const themeIcon = gameState?.theme?.[squareId]?.icon;

  return (
    <span className="trade-square">
      {colorClass
        ? <span className={"trade-swatch " + colorClass} />
        : <FontAwesomeIcon className="trade-square-icon" fixedWidth
          icon={config?.type === SquareType.Utility && themeIcon !== "subway" ? faLightbulb : faTrain} />}
      <span className="trade-square-name">{getSquareTxt(gameState, squareId)}</span>
      {data?.isMortgaged && <span className="trade-tag">mortgaged</span>}
    </span>
  );
};

/** A player's piece and name in their colour. */
export const TradePlayer: React.FC<{ playerId: string; fallbackName?: string }> = ({ playerId, fallbackName }) => {
  const gameState = useGameStateStore(state => state.data);
  const p: Player | undefined = gameState?.players.find((pl) => areObjectIdsEqual(pl._id, playerId));
  if (!p) {
    return <span className="trade-player">{fallbackName ?? ""}</span>;
  }
  return (
    <span className="trade-player" style={{ color: p.color }}>
      <FontAwesomeIcon icon={getIconProp(p.type)} /> {p.name}
    </span>
  );
};

/** One side of the trade: what one participant hands over. */
const TradeSide: React.FC<{
  kind: "get" | "give" | "neutral";
  title: React.ReactNode;
  side: TradeParticipant;
}> = ({ kind, title, side }) => (
  <div className={"trade-side " + kind}>
    <div className="trade-side-head">
      {kind !== "neutral" && <FontAwesomeIcon icon={kind === "get" ? faArrowDown : faArrowUp} />}
      {title}
    </div>
    <ul className="trade-items">
      {side.amountGiven > 0 &&
        <li className="trade-cash"><FontAwesomeIcon icon={faCoins} fixedWidth /> {dollarFormatter.format(side.amountGiven)}</li>}
      {side.squaresGiven.map((id) => <li key={id}><TradeSquare squareId={id} /></li>)}
      {side.amountGiven <= 0 && side.squaresGiven.length === 0 && <li className="trade-nothing">Nothing</li>}
    </ul>
  </div>
);

interface Props {
  participant1: TradeParticipant;
  participant2: TradeParticipant;
}

/**
 * What changes hands in a trade, from the viewer's side: "You get" (what the
 * other player gives) and "You give", with the net cash. Players not in the
 * trade see "<name> gives" for each side instead.
 */
export const TradeSummary: React.FC<Props> = ({ participant1, participant2 }) => {

  const myId = getMyUserId();
  const iAmP1 = areObjectIdsEqual(participant1.playerId, myId);
  const iAmP2 = areObjectIdsEqual(participant2.playerId, myId);

  if (!iAmP1 && !iAmP2) {
    return (
      <div className="trade-summary">
        <TradeSide kind="neutral" side={participant1}
          title={<><TradePlayer playerId={participant1.playerId} fallbackName={participant1.playerName} /> gives</>} />
        <TradeSide kind="neutral" side={participant2}
          title={<><TradePlayer playerId={participant2.playerId} fallbackName={participant2.playerName} /> gives</>} />
      </div>
    );
  }

  const me = iAmP1 ? participant1 : participant2;
  const them = iAmP1 ? participant2 : participant1;
  const netCash = them.amountGiven - me.amountGiven;

  return (
    <React.Fragment>
      <div className="trade-summary">
        <TradeSide kind="get" side={them}
          title={<>You get <span className="trade-from">from <TradePlayer playerId={them.playerId} fallbackName={them.playerName} /></span></>} />
        <TradeSide kind="give" side={me}
          title={<>You give <span className="trade-from">to <TradePlayer playerId={them.playerId} fallbackName={them.playerName} /></span></>} />
      </div>
      {netCash !== 0 &&
        <div className={"trade-net " + (netCash > 0 ? "plus" : "minus")}>
          Cash for you: {netCash > 0 ? "+" : "−"}{dollarFormatter.format(Math.abs(netCash))}
        </div>}
    </React.Fragment>
  );
};
