import React from "react";
import { Link, useHistory } from "react-router-dom";
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
import { getGameContextFromLocalStorage, getObjectIdAsHexString, leaveCurrentGameIfJoined } from "../helpers";
import { GameContext } from "../../core/types/GameContext";
import { useQuery } from "react-query";

interface Props {

}

export const DisplayAllGames: React.FC<Props> = () => {

  const context: GameContext = getGameContextFromLocalStorage();
  const history = useHistory();


  const onJoinGame = (gameId: string) => {

    leaveCurrentGameIfJoined(null, () => {
      history.push("/join?gid=" + gameId);
    });
  };

  const gamesQuery = useQuery<GameToJoin[], Error>("getAllGames",
    () => API.post("findGames", { context }).then(function (response) { return response.data.games; }));



  const displayGameList = () => {
    if (gamesQuery.isLoading || !gamesQuery.data) {
      return <div>Loading...</div>;
    }
    if (gamesQuery.isError) {
      return <div>{gamesQuery.error!.message}</div>;
    }

    return (<Table className="find-games" aria-label="simple table">
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell align="right"># Players</TableCell>
          <TableCell align="right"></TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {gamesQuery.data.map((g) => (
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
    </Table>);
  }

  return (
    <React.Fragment>
      <TableContainer component={Paper}>

        {displayGameList()}
        <br />
        <Link to="/dashboard">GO BACK</Link>

      </TableContainer>

    </React.Fragment>
  );

}
