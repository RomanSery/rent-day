import React, { useState, useEffect } from "react";
import API from '../api';
import { Button } from "@material-ui/core";
import { GameState } from "../../core/types/GameState";
import { Player } from "../../core/types/Player";

interface Props {
  gameInfo: GameState | undefined;
  player: Player;
}

export const DisplayPlayer: React.FC<Props> = ({ gameInfo, player }) => {

  console.log(player.color);

  const getColorStyle = (): React.CSSProperties => {
    return { borderColor: player.color };
  };

  return (
    <React.Fragment>
      <div className="player-info" style={getColorStyle()}>
        <div className="container">
          <div className="name">
            {player.name}
          </div>
          <div className="money">
            ${player.money}
          </div>
          <div className="actions">
            <Button variant="contained" color="secondary">
              Trade
            </Button>
          </div>
        </div>

      </div>
    </React.Fragment>
  );

};
