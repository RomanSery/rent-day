import React from "react";
import { GameState } from "../../core/types/GameState";
import DialogTitle from '@material-ui/core/DialogTitle';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import Button from '@material-ui/core/Button';
import { dollarFormatter, getGameContextFromLocalStorage } from "../helpers";
import { GameContext } from "../../core/types/GameContext";

import { SocketService } from "../sockets/SocketService";
import { DataGrid, ColDef, RowsProp, RowModel, ValueFormatterParams } from '@material-ui/data-grid';
import { Player } from "../../core/types/Player";

interface Props {
  open: boolean;
  gameInfo: GameState | undefined;
  onClose: () => void;
  socketService: SocketService;
}

export const StatsDialog: React.FC<Props> = ({ open, gameInfo, onClose, socketService }) => {

  const context: GameContext = getGameContextFromLocalStorage();

  const columns: ColDef[] = [
    { field: 'playerName', headerName: 'Player', type: 'string', width: 130 },
    {
      field: 'money',
      headerName: 'Money',
      type: 'number',
      flex: 1,
      valueFormatter: (params: ValueFormatterParams) =>
        dollarFormatter.format((params.value as number)),
    },
    {
      field: 'taxPerTurn',
      headerName: 'Tax',
      type: 'number',
      flex: 1,
      valueFormatter: (params: ValueFormatterParams) =>
        dollarFormatter.format((params.value as number)),
    },
    {
      field: 'electricityPerTurn',
      headerName: 'Electricity',
      type: 'number',
      flex: 1,
      valueFormatter: (params: ValueFormatterParams) =>
        dollarFormatter.format((params.value as number)),
    },
    {
      field: 'totalAssets',
      headerName: 'Total Assets',
      type: 'number',
      flex: 1,
      valueFormatter: (params: ValueFormatterParams) =>
        dollarFormatter.format((params.value as number)),
    },
    {
      field: 'mortgageableValue',
      headerName: 'Mortgageable Value',
      type: 'number',
      flex: 1,
      valueFormatter: (params: ValueFormatterParams) =>
        dollarFormatter.format((params.value as number)),
    },
    {
      field: 'redeemableValue',
      headerName: 'Redeemable Value',
      type: 'number',
      flex: 1,
      valueFormatter: (params: ValueFormatterParams) =>
        dollarFormatter.format((params.value as number)),
    },
  ];


  const getDataRows = (): RowsProp => {
    if (!gameInfo) {
      return [];
    }

    //mortgagable value, redeemable value, other things in sortable table 

    const rows: Array<RowModel> = [];
    gameInfo.players.forEach((p: Player, key: number) => {
      rows.push({
        id: p._id,
        playerName: p.name,
        money: p.money,
        taxPerTurn: p.taxesPerTurn,
        electricityPerTurn: p.electricityCostsPerTurn,
        totalAssets: p.totalAssets,
        mortgageableValue: p.mortgageableValue,
        redeemableValue: p.redeemableValue
      });
    });

    return rows;
  }

  return (
    <Dialog fullWidth={true} maxWidth="lg" onClose={onClose} aria-labelledby="stats-dialog-title" open={open}>
      <DialogTitle id="trade-dialog-title">Stats</DialogTitle>
      <DialogContent>
        <div style={{ height: 400, width: '90%' }}>
          <DataGrid rows={getDataRows()} columns={columns} pageSize={10} autoHeight={true} density="compact"
            showToolbar={false} disableColumnMenu={true} disableColumnSelector={true}
            disableSelectionOnClick={true} hideFooter={true} hideFooterPagination={true} checkboxSelection={false} />
        </div>

      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">Cancel</Button>
      </DialogActions>
    </Dialog>
  );

};
