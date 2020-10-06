import React, { useState, useEffect } from "react";
import API from '../api';
import { Button } from "@material-ui/core";
import { PlayersDisplay } from "./PlayersDisplay";
import { GameState } from "../../core/types/GameState";

interface Props {
  gameInfo: GameState | undefined;
}

export const CenterDisplay: React.FC<Props> = ({ gameInfo }) => {

  const [serverResult, setServerResult] = useState<string | null>(null);


  const onRollDice = async () => {

    API.get("hello")
      .then(function (response) {
        // handle success
        console.log(response);
        setServerResult(response.data);
      })
      .catch(function (error) {
        // handle error
        console.log(error);
      });
  };

  return (
    <React.Fragment>
      <div className="center-square square">
        <PlayersDisplay gameInfo={gameInfo} />

        <div className="player-actions">
          <Button variant="contained" color="primary" onClick={onRollDice}>
            Roll dice
        </Button>

          <p>Server result {serverResult}</p>
        </div>


      </div>
    </React.Fragment>
  );

};
