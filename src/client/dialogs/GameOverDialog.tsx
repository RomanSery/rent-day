import React from "react";
import DialogTitle from '@material-ui/core/DialogTitle';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import Button from '@material-ui/core/Button';
import { areObjectIdsEqual, getIconProp } from "../helpers";
import { DataGrid, GridColDef, GridRowsProp, GridRowModel, ValueFormatterParams } from '@material-ui/data-grid';
import { Player } from "../../core/types/Player";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Container, List, ListItem, ListItemText } from "@material-ui/core";
import useGameStateStore from "../gameStateStore";


interface Props {
  open: boolean;
  onLeaveGame: () => void;
}

export const GameOverDialog: React.FC<Props> = ({ open, onLeaveGame }) => {

  const gameState = useGameStateStore(state => state.data);

  const getPlayerById = (params: ValueFormatterParams) => {
    if (gameState) {
      const playerId = params.getValue('id')?.toLocaleString();
      return gameState.players.find((p: Player) => areObjectIdsEqual(p._id, playerId));
    }
    return null;
  }

  const getColorStyle = (params: ValueFormatterParams): React.CSSProperties => {
    const player = getPlayerById(params);
    if (player) {
      return { color: player.color };
    }
    return {};
  };

  const columns: GridColDef[] = [
    { field: 'id', hide: true },
    {
      field: 'playerName', headerName: 'Player', type: 'string', sortable: false,
      renderCell: (params: ValueFormatterParams) => (
        <React.Fragment>
          <div style={getColorStyle(params)}>
            <FontAwesomeIcon icon={getIconProp(getPlayerById(params)!.type)} size="1x" color={getPlayerById(params)!.color} />
            &nbsp;&nbsp;
            {params.getValue('playerName')}
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
    <Dialog fullWidth={true} maxWidth="md" disableBackdropClick={true} disableEscapeKeyDown={true} aria-labelledby="game-over-dialog-title" open={open}>
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


        <div style={{ height: 400, width: '100%' }}>
          <DataGrid rows={getDataRows()} columns={columns} pageSize={10} autoHeight={true} density="compact"
            disableColumnMenu={true} disableColumnSelector={true}
            disableSelectionOnClick={true} hideFooter={true} hideFooterPagination={true} checkboxSelection={false} />
        </div>

      </DialogContent>
      <DialogActions>
        <Button onClick={onLeaveGame} color="primary" variant="contained">LEAVE</Button>
      </DialogActions>
    </Dialog>
  );

};
