import React from "react";
import { Link, useHistory } from "react-router-dom";
import API from '../api';
import { Button } from "@mui/material";

import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import { GameToJoin } from "../../core/types/GameToJoin";
import { getGameContextFromLocalStorage, getObjectIdAsHexString, leaveCurrentGameIfJoined } from "../helpers";
import { GameContext } from "../../core/types/GameContext";
import { useQuery } from "@tanstack/react-query";

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

  const gamesQuery = useQuery<GameToJoin[], Error>({
    queryKey: ["getAllGames"],
    queryFn: () => API.post("findGames", { context }).then(function (response) { return response.data.games; }),
  });



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
