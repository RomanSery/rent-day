import React from "react";
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Button from '@mui/material/Button';
import { areObjectIdsEqual, dollarFormatter, getMyUserId } from "../helpers";
import { DataGrid, GridColDef, GridRowsProp, GridRowModel } from '@mui/x-data-grid';
import useGameStateStore from "../stores/gameStateStore";

interface Props {

}

export const MyTaxesDialog: React.FC<Props> = () => {

  const gameState = useGameStateStore(state => state.data);
  const taxesViewOpen = useGameStateStore(state => state.taxesViewOpen);
  const setTaxesViewOpen = useGameStateStore(state => state.setTaxesViewOpen);

  const columns: GridColDef[] = [
    {
      field: 'propertyName', headerName: 'Property', type: 'string', flex: 0.5
    },
    {
      field: 'tax',
      headerName: 'Tax',
      type: 'number',
      flex: 0.5,
      valueFormatter: (value: number) => dollarFormatter.format(value),
    },
    {
      field: 'adjustedTax',
      headerName: 'Adjusted Tax',
      type: 'number',
      flex: 0.5,
      valueFormatter: (value: number) => dollarFormatter.format(value),
    }
  ];

  const getSquareId = (row: string): number => {
    return parseInt(row.split(',')[0]);
  }

  const getDataRows = (): GridRowsProp => {
    if (!gameState) {
      return [];
    }

    const myPlayer = gameState.players.find((p) => areObjectIdsEqual(p._id, getMyUserId()));
    if (!myPlayer) {
      return [];
    }

    if (!myPlayer.taxTooltip || myPlayer.taxTooltip.length === 0) {
      return [];
    }

    const taxBreakdown = myPlayer.taxTooltip.split(';');

    const rows: Array<GridRowModel> = [];
    taxBreakdown.forEach((s) => {

      const tax = parseInt(s.split(',')[1].replace('$', '').replace(',', ''));
      const adjustedTax = parseInt(s.split(',')[2].replace('$', '').replace(',', ''));

      rows.push({
        id: getSquareId(s),
        propertyName: gameState.theme[getSquareId(s)].name,
        tax: tax,
        adjustedTax: adjustedTax
      });
    });
    return rows;
  }

  return (
    <Dialog fullWidth={true} maxWidth="xl" onClose={() => setTaxesViewOpen(false)} aria-labelledby="taxes-dialog-title" open={taxesViewOpen}>
      <DialogTitle id="taxes-dialog-title">My Taxes</DialogTitle>
      <DialogContent>
        <div style={{ height: 400, width: '100%' }}>
          <DataGrid rows={getDataRows()} columns={columns} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }} pageSizeOptions={[10]} autoHeight={true} density="compact"
            disableColumnMenu={true} disableColumnSelector={true}
            disableRowSelectionOnClick={true} hideFooter={true} hideFooterPagination={true} checkboxSelection={false} />
        </div>

      </DialogContent>
      <DialogActions>
        <Button onClick={() => setTaxesViewOpen(false)} color="primary">Close</Button>
      </DialogActions>
    </Dialog>
  );

};
