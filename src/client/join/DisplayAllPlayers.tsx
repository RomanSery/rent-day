/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import API from '../api';

import TableContainer from '@material-ui/core/TableContainer';
import Paper from '@material-ui/core/Paper';
import { getGameContextFromLocalStorage, handleApiError } from "../helpers";
import { GameContext } from "../../core/types/GameContext";
import { PlayerInfo } from "../../core/types/PlayerInfo";
import { DataGrid, GridColDef, GridRowsProp, GridRowModel } from '@material-ui/data-grid';
import { Link } from "react-router-dom";

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

    const rows: Array<GridRowModel> = [];

    players.forEach((p: PlayerInfo, key: number) => {
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


  return (
    <React.Fragment>
      <TableContainer component={Paper}>

        <DataGrid rows={getDataRows()} columns={columns} autoHeight={true} density="compact"
          disableColumnMenu={true} disableColumnSelector={true}
          disableSelectionOnClick={true} hideFooter={true} hideFooterPagination={true} checkboxSelection={false} />

        <br />
        <Link to="/dashboard">GO BACK</Link>

      </TableContainer>

    </React.Fragment>
  );
}
