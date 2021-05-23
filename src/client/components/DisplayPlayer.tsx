import React, { TouchEvent } from "react";
import { Player } from "../../core/types/Player";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { areObjectIdsEqual, dollarFormatter, getIconProp } from "../helpers";
import { faBiohazard } from "@fortawesome/free-solid-svg-icons";
import { PlayerState } from "../../core/enums/PlayerState";
import useGameStateStore from "../gameStateStore";

interface Props {
  player: Player;
  viewPlayer: (player: Player) => void;
  clearPlayer: () => void;
}

export const DisplayPlayer: React.FC<Props> = ({ player, viewPlayer, clearPlayer }) => {

  const gameState = useGameStateStore(state => state.data);

  const getColorStyle = (): React.CSSProperties => {
    if (isPlayersTurn()) {
      return { borderColor: player.color };
    }
    return { borderWidth: 0 };
  };

  const getNameColorStyle = (): React.CSSProperties => {
    return { color: player.color };
  };

  const isPlayersTurn = () => {
    return gameState && gameState.nextPlayerToAct && areObjectIdsEqual(player._id, gameState.nextPlayerToAct);
  }


  const setPlayerToView = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (player && player._id) {
      viewPlayer(player);
    }
  };
  const setPlayerToView2 = (event: TouchEvent<HTMLDivElement>) => {
    if (player && player._id) {
      viewPlayer(player);
    }
  };
  const leavePlayer = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    clearPlayer();
  };


  return (
    <React.Fragment>
      <div className="player-info" style={getColorStyle()} onTouchStart={setPlayerToView2} onClick={setPlayerToView} onMouseEnter={setPlayerToView} onMouseLeave={leavePlayer}>
        <div className="container">
          <div className="name">
            <FontAwesomeIcon icon={getIconProp(player.type)} size="2x" color={player.color} />
            {player.state === PlayerState.IN_ISOLATION ? <FontAwesomeIcon icon={faBiohazard} size="2x" color="black" /> : null}
            <div className="ping">{player.playerClass}</div>
          </div>
          <div className="sub-name" style={getNameColorStyle()}>
            {player.name}
            {player.state !== PlayerState.BANKRUPT ?
              <div className="money">{dollarFormatter.format(player.money)}</div> :
              <div className="money-bankrupt">BANKRUPT</div>}
          </div>
        </div>

      </div>
    </React.Fragment>
  );

};
