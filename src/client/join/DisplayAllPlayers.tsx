/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import API from '../api';

import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import { getGameContextFromLocalStorage, handleApiError } from "../helpers";
import { GameContext } from "../../core/types/GameContext";
import { PlayerInfo } from "../../core/types/PlayerInfo";

interface Props {

}

export const DisplayAllPlayers: React.FC<Props> = () => {

  const context: GameContext = getGameContextFromLocalStorage();
  const [players, setPlayers] = useState<PlayerInfo[]>([]);

  useEffect(() => {

    API.post("findPlayers", { context })
      .then(function (response) {
        setPlayers(response.data.players);
      })
      .catch(handleApiError);
  }, []);


  return (
    <React.Fragment>
      <TableContainer component={Paper}>
        <Table className="find-games" aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell align="right">Wins</TableCell>
              <TableCell align="right">Games Played</TableCell>
              <TableCell align="right">Playing now</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {players.map((p) => (
              <TableRow key={p.name}>
                <TableCell component="th" scope="row">{p.name}</TableCell>
                <TableCell align="right">{p.wins}</TableCell>
                <TableCell align="right">{p.gamesPlayed}</TableCell>
                <TableCell align="right">{p.currGame}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

    </React.Fragment>
  );
}
