import React from "react";
import API from '../api';

import TableContainer from '@material-ui/core/TableContainer';
import Paper from '@material-ui/core/Paper';
import { getGameContextFromLocalStorage } from "../helpers";
import { GameContext } from "../../core/types/GameContext";
import { PlayerInfo } from "../../core/types/PlayerInfo";
import { DataGrid, GridColDef, GridRowsProp, GridRowModel } from '@material-ui/data-grid';
import { Link } from "react-router-dom";
import { useQuery } from "react-query";

interface Props {

}

export const DisplayAllPlayers: React.FC<Props> = () => {

  const context: GameContext = getGameContextFromLocalStorage();

  const playersQuery = useQuery<PlayerInfo[], Error>("getAllPlayers",
    () => API.post("findPlayers", { context }).then(function (response) { return response.data.players; }),
    { refetchOnWindowFocus: false });

  const columns: GridColDef[] = [
    { field: 'id', hide: true },
    {
      field: 'name',
      headerClassName: 'game-grid-header',
      headerName: 'Name',
      type: 'string',
      flex: 1
    },
    {
      field: 'wins',
      headerClassName: 'game-grid-header',
      headerName: 'Wins',
      type: 'number',
      flex: 0.5
    },
    {
      field: 'gamesPlayed',
      headerClassName: 'game-grid-header',
      headerName: 'Games Played',
      type: 'number',
      flex: 1
    },
    {
      field: 'currGame',
      headerClassName: 'game-grid-header',
      headerName: 'Playing now',
      type: 'string',
      flex: 1
    }
  ];


  const getDataRows = (): GridRowsProp => {

    if (!playersQuery.data) {
      return [];
    }

    const rows: Array<GridRowModel> = [];

    playersQuery.data.forEach((p: PlayerInfo, key: number) => {
      rows.push({
        id: p.playerId,
        name: p.name,
        wins: p.wins,
        gamesPlayed: p.gamesPlayed,
        currGame: p.currGame
      });
    });

    return rows;
  }

  const getPlayerDisplay = () => {
    if (playersQuery.isLoading || !playersQuery.data) {
      return <div>Loading...</div>;
    }
    if (playersQuery.isError) {
      return <div>{playersQuery.error!.message}</div>;
    }

    return (<DataGrid rows={getDataRows()} columns={columns} autoHeight={true} density="compact"
      disableColumnMenu={true} disableColumnSelector={true}
      disableSelectionOnClick={true} hideFooter={true} hideFooterPagination={true} checkboxSelection={false} />);
  }


  return (
    <React.Fragment>
      <TableContainer component={Paper}>

        {getPlayerDisplay()}
        <br />
        <Link to="/dashboard">GO BACK</Link>

      </TableContainer>

    </React.Fragment>
  );
}
