import React, { useState, useEffect } from "react";
import API from '../api';
import { Button } from "@material-ui/core";
import { GameState } from "../../core/types/GameState";
import { Player } from "../../core/types/Player";

interface Props {
  gameInfo: GameState | undefined;
}

export const PlayersDisplay: React.FC<Props> = ({ gameInfo }) => {

  return (
    <React.Fragment>
      <div className="players-display">
        <strong>List of players</strong>

        <ul>
          {gameInfo?.players.map((p: Player, index) => {


            return (<li>{p.name}</li>)
          })}

        </ul>

      </div>

    </React.Fragment>
  );

};
