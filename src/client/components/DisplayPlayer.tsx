import React from "react";
import { Player } from "../../core/types/Player";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { areObjectIdsEqual, dollarFormatter, getIconProp, getMyUserId } from "../helpers";
import { faBiohazard, faRobot } from "@fortawesome/free-solid-svg-icons";
import { PlayerState } from "../../core/enums/PlayerState";
import useGameStateStore from "../stores/gameStateStore";

interface Props {
  player: Player;
  viewPlayer: (player: Player) => void;
  clearPlayer: () => void;
}

/**
 * One row of the player list: piece, name and money, with class (and your own
 * per-turn costs) underneath. The player whose turn it is gets a coloured edge.
 */
export const DisplayPlayer: React.FC<Props> = ({ player, viewPlayer, clearPlayer }) => {

  const gameState = useGameStateStore(state => state.data);

  const isTheirTurn = !!(gameState?.nextPlayerToAct && areObjectIdsEqual(player._id, gameState.nextPlayerToAct));
  const isMe = areObjectIdsEqual(player._id, getMyUserId());
  const bankrupt = player.state === PlayerState.BANKRUPT;

  const className = ["player-info", isTheirTurn ? "their-turn" : "", isMe ? "is-me" : "", bankrupt ? "bankrupt" : ""]
    .filter(Boolean).join(" ");

  return (
    <div className={className} style={isTheirTurn ? { borderLeftColor: player.color } : undefined}
      onTouchStart={() => viewPlayer(player)} onClick={() => viewPlayer(player)}
      onMouseEnter={() => viewPlayer(player)} onMouseLeave={() => clearPlayer()}>

      <div className="player-row-main">
        <FontAwesomeIcon className="player-piece" icon={getIconProp(player.type)} color={player.color} fixedWidth />
        <span className="player-name" style={{ color: player.color }}>{player.name}</span>
        {bankrupt
          ? <span className="money money-bankrupt">Bankrupt</span>
          : <span className="money">{dollarFormatter.format(player.money)}</span>}
      </div>

      <div className="player-row-sub">
        {player.state === PlayerState.IN_ISOLATION && <FontAwesomeIcon icon={faBiohazard} color="#c62828" title="In quarantine" />}
        {player.isBot && <FontAwesomeIcon icon={faRobot} title="Computer player" />}
        <span>{player.playerClass}</span>
        {isMe && !bankrupt && player.taxesPerTurn + player.electricityCostsPerTurn > 0 &&
          <span className="player-costs" title="Tax and electricity you pay each turn">
            −{dollarFormatter.format(player.taxesPerTurn + player.electricityCostsPerTurn)}/turn
          </span>}
      </div>
    </div>
  );

};
