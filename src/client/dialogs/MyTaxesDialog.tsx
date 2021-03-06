import React from "react";
import { GameState } from "../../core/types/GameState";
import DialogTitle from '@material-ui/core/DialogTitle';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import Button from '@material-ui/core/Button';
import { areObjectIdsEqual, dollarFormatter, getMyUserId } from "../helpers";
import { DataGrid, GridColDef, GridRowsProp, GridRowModel, ValueFormatterParams } from '@material-ui/data-grid';

interface Props {
  open: boolean;
  gameInfo: GameState | undefined;
  onClose: () => void;
}

export const MyTaxesDialog: React.FC<Props> = ({ open, gameInfo, onClose }) => {

  const columns: GridColDef[] = [
    { field: 'id', hide: true },
    {
      field: 'propertyName', headerName: 'Property', type: 'string', flex: 0.5
    },
    {
      field: 'tax',
      headerName: 'Tax',
      type: 'number',
      flex: 0.5,
      valueFormatter: (params: ValueFormatterParams) =>
        dollarFormatter.format((params.value as number)),
    },
    {
      field: 'adjustedTax',
      headerName: 'Adjusted Tax',
      type: 'number',
      flex: 0.5,
      valueFormatter: (params: ValueFormatterParams) =>
        dollarFormatter.format((params.value as number)),
    }
  ];

  const getSquareId = (row: string): number => {
    return parseInt(row.split(',')[0]);
  }

  const getDataRows = (): GridRowsProp => {
    if (!gameInfo) {
      return [];
    }

    const myPlayer = gameInfo.players.find((p) => areObjectIdsEqual(p._id, getMyUserId()));
    if (!myPlayer) {
      return [];
    }

    const taxBreakdown = myPlayer.taxTooltip.split(';');

    const rows: Array<GridRowModel> = [];
    taxBreakdown.forEach((s) => {

      const tax = parseInt(s.split(',')[1].replace('$', '').replace(',', ''));
      const adjustedTax = parseInt(s.split(',')[2].replace('$', '').replace(',', ''));

      rows.push({
        id: getSquareId(s),
        propertyName: gameInfo.theme[getSquareId(s)].name,
        tax: tax,
        adjustedTax: adjustedTax
      });
    });
    return rows;
  }

  return (
    <Dialog fullWidth={true} maxWidth="xl" onClose={onClose} aria-labelledby="taxes-dialog-title" open={open}>
      <DialogTitle id="taxes-dialog-title">My Taxes</DialogTitle>
      <DialogContent>
        <div style={{ height: 400, width: '100%' }}>
          <DataGrid rows={getDataRows()} columns={columns} pageSize={10} autoHeight={true} density="compact"
            disableColumnMenu={true} disableColumnSelector={true}
            disableSelectionOnClick={true} hideFooter={true} hideFooterPagination={true} checkboxSelection={false} />
        </div>

      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">Close</Button>
      </DialogActions>
    </Dialog>
  );

};
