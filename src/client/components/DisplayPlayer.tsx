import React from "react";
import { GameState } from "../../core/types/GameState";
import { Player } from "../../core/types/Player";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { areObjectIdsEqual, getIconProp, getMyUserId } from "../helpers";
import { faBiohazard, faHandshake } from "@fortawesome/free-solid-svg-icons";
import { PlayerState } from "../../core/enums/PlayerState";

interface Props {
  gameInfo: GameState | undefined;
  player: Player;
  getPing: (userId: string | undefined) => string;
  viewPlayer: (player: Player) => void;
  tradeWithPlayer: (player: Player) => void;
  clearPlayer: () => void;
}

export const DisplayPlayer: React.FC<Props> = ({ gameInfo, player, getPing, viewPlayer, clearPlayer, tradeWithPlayer }) => {

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
    return gameInfo && gameInfo.nextPlayerToAct && areObjectIdsEqual(player._id, gameInfo.nextPlayerToAct);
  }

  const canOfferTrade = () => {
    const uid = getMyUserId();
    if (areObjectIdsEqual(player._id, uid)) {
      return false;
    }
    return uid && gameInfo && gameInfo.nextPlayerToAct && areObjectIdsEqual(uid, gameInfo.nextPlayerToAct) && gameInfo.auctionId == null;
  }


  const setPlayerToView = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (player && player._id) {
      viewPlayer(player);
    }
  };
  const leavePlayer = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    clearPlayer();
  };

  return (
    <React.Fragment>
      <div className="player-info" style={getColorStyle()} onMouseEnter={setPlayerToView} onMouseLeave={leavePlayer}>
        <div className="container">
          <div className="name">
            <FontAwesomeIcon icon={getIconProp(player.type)} size="2x" color={player.color} />
            {player.state === PlayerState.IN_ISOLATION ? <FontAwesomeIcon icon={faBiohazard} size="2x" color="black" /> : null}
            <div className="ping">{getPing(player._id)}</div>
          </div>
          <div className="sub-name" style={getNameColorStyle()}>
            {player.name}
            <div className="money">
              ${player.money}
            </div>
          </div>
          {canOfferTrade() ? <div className="trade" onClick={() => tradeWithPlayer(player)}><FontAwesomeIcon icon={faHandshake} /></div> : null}

        </div>

      </div>
    </React.Fragment>
  );

};
