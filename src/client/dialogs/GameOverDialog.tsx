import React from "react";
import { GameState } from "../../core/types/GameState";
import DialogTitle from '@material-ui/core/DialogTitle';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import Button from '@material-ui/core/Button';
import { areObjectIdsEqual, getIconProp } from "../helpers";
import { DataGrid, ColDef, RowsProp, RowModel, ValueFormatterParams } from '@material-ui/data-grid';
import { Player } from "../../core/types/Player";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";


interface Props {
  open: boolean;
  gameInfo: GameState | undefined;
  onLeaveGame: () => void;
}

export const GameOverDialog: React.FC<Props> = ({ open, gameInfo, onLeaveGame }) => {

  const getPlayerById = (params: ValueFormatterParams) => {
    if (gameInfo) {
      const playerId = params.getValue('id')?.toLocaleString();
      return gameInfo.players.find((p: Player) => areObjectIdsEqual(p._id, playerId));
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

  const columns: ColDef[] = [
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


  const getDataRows = (): RowsProp => {
    if (!gameInfo) {
      return [];
    }

    const rows: Array<RowModel> = [];

    const players: Player[] = gameInfo.players;
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

  return (
    <Dialog fullWidth={true} maxWidth="xl" disableBackdropClick={true} disableEscapeKeyDown={true} aria-labelledby="stats-dialog-title" open={open}>
      <DialogTitle id="trade-dialog-title">Game Over</DialogTitle>
      <DialogContent>
        <div style={{ height: 400, width: '100%' }}>
          <DataGrid rows={getDataRows()} columns={columns} pageSize={10} autoHeight={true} density="compact"
            showToolbar={false} disableColumnMenu={true} disableColumnSelector={true}
            disableSelectionOnClick={true} hideFooter={true} hideFooterPagination={true} checkboxSelection={false} />
        </div>

      </DialogContent>
      <DialogActions>
        <Button onClick={onLeaveGame} color="primary" variant="contained">LEAVE</Button>
      </DialogActions>
    </Dialog>
  );

};
