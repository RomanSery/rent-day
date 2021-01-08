import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import API from '../api';
import { Button } from "@material-ui/core";

import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import { GameToJoin } from "../../core/types/GameToJoin";
import { getGameContextFromLocalStorage, getObjectIdAsHexString, leaveCurrentGameIfJoined, StorageConstants } from "../helpers";
import { GameContext } from "../../core/types/GameContext";

interface Props {

}

export const DisplayAllGames: React.FC<Props> = () => {

  const context: GameContext = getGameContextFromLocalStorage();
  const history = useHistory();
  const [games, setGames] = useState<GameToJoin[]>([]);

  useEffect(() => {

    API.post("findGames", { context })
      .then(function (response) {
        console.log(response.data.games);
        setGames(response.data.games);
      })
      .catch(function (error) {
        console.log(error);
      });
  });

  const onJoinGame = (gameId: string) => {

    leaveCurrentGameIfJoined(() => {
      localStorage.setItem(StorageConstants.GAME_ID, getObjectIdAsHexString(gameId));
      history.push("/join");
    });
  };


  return (
    <React.Fragment>
      <TableContainer component={Paper}>
        <Table className="find-games" aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell align="right"># Players</TableCell>
              <TableCell align="right"></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {games.map((g) => (
              <TableRow key={getObjectIdAsHexString(g.gameId)}>
                <TableCell component="th" scope="row">
                  {g.name}
                </TableCell>
                <TableCell align="right">{g.playersJoined} / {g.maxPlayers}</TableCell>
                <TableCell align="right">
                  <Button variant="contained" color="secondary" onClick={() => onJoinGame(g.gameId)}>Join</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

    </React.Fragment>
  );
}
