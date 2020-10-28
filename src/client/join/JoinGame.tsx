import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { GameContext } from "../../core/types/GameContext";
import { GameState } from "../../core/types/GameState";
import { getGameContextFromUrl } from "../api";
import API from '../api';


interface Props {

}

export const JoinGame: React.FC<Props> = () => {

  const location = useLocation();


  return (
    <React.Fragment>
      <div>

        join
      </div>
    </React.Fragment>
  );
}
