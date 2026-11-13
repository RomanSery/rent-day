import React from "react";
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Button from '@mui/material/Button';
import { areObjectIdsEqual, getIconProp } from "../helpers";
import { DataGrid, GridColDef, GridRowsProp, GridRowModel, GridRenderCellParams } from '@mui/x-data-grid';
import { Player } from "../../core/types/Player";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Container, List, ListItem, ListItemText } from "@mui/material";
import useGameStateStore from "../stores/gameStateStore";
import { NetWorthChart } from "../juice/NetWorthChart";


interface Props {
  open: boolean;
  onLeaveGame: () => void;
}

export const GameOverDialog: React.FC<Props> = ({ open, onLeaveGame }) => {

  const gameState = useGameStateStore(state => state.data);

  const getPlayerById = (params: GridRenderCellParams) => {
    if (gameState) {
      const playerId = String(params.row.id);
      return gameState.players.find((p: Player) => areObjectIdsEqual(p._id, playerId));
    }
    return null;
  }

  const getColorStyle = (params: GridRenderCellParams): React.CSSProperties => {
    const player = getPlayerById(params);
    if (player) {
      return { color: player.color };
    }
    return {};
  };

  const columns: GridColDef[] = [
    {
      field: 'playerName', headerName: 'Player', type: 'string', sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <React.Fragment>
          <div style={getColorStyle(params)}>
            <FontAwesomeIcon icon={getIconProp(getPlayerById(params)!.type)} size="1x" color={getPlayerById(params)!.color} />
            &nbsp;&nbsp;
            {params.row.playerName}
          </div>
        </React.Fragment>
      )
    },
    {
      field: 'finishedRank',
      headerName: 'Placing',
      type: 'number',
      sortable: false,
    }
  ];


  const getDataRows = (): GridRowsProp => {
    if (!gameState) {
      return [];
    }

    const rows: Array<GridRowModel> = [];

    const players: Player[] = gameState.players;
    players.sort(function (a: Player, b: Player) {
      return a.finishedRank! - b.finishedRank!;
    });

    players.forEach((p: Player, key: number) => {
      rows.push({
        id: p._id,
        playerName: p.name,
        finishedRank: p.finishedRank
      });
    });

    return rows;
  }

  const getGameLength = () => {
    if (gameState) {
      return "Game Length: " + gameState.gameLength + " minutes";
    }
    return "";
  }

  const getWinnerName = () => {
    if (gameState) {
      return "Winner: " + gameState.winner;
    }
    return "";
  }

  return (
    <Dialog fullWidth={true} maxWidth="md" aria-labelledby="game-over-dialog-title" open={open}>
      <DialogTitle id="game-over-dialog-title">Game Over</DialogTitle>
      <DialogContent>

        <Container maxWidth="xs">
          <List dense={true} className="game-over-overview">
            <ListItem>
              <ListItemText primary={getWinnerName()} />
            </ListItem>
            <ListItem>
              <ListItemText primary={getGameLength()} />
            </ListItem>
          </List>
        </Container>


        {open && gameState && <NetWorthChart gameId={gameState._id} players={gameState.players} />}

        <div style={{ height: 400, width: '100%' }}>
          <DataGrid rows={getDataRows()} columns={columns} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }} pageSizeOptions={[10]} autoHeight={true} density="compact"
            disableColumnMenu={true} disableColumnSelector={true}
            disableRowSelectionOnClick={true} hideFooter={true} hideFooterPagination={true} checkboxSelection={false} />
        </div>

      </DialogContent>
      <DialogActions>
        <Button onClick={onLeaveGame} color="primary" variant="contained">LEAVE</Button>
      </DialogActions>
    </Dialog>
  );

};
