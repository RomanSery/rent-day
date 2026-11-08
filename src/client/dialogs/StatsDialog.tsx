import React from "react";
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Button from '@mui/material/Button';
import { areObjectIdsEqual, dollarFormatter, getIconProp, getMyUserId } from "../helpers";
import { DataGrid, GridColDef, GridRowsProp, GridRowModel, GridRenderCellParams } from '@mui/x-data-grid';
import { Player } from "../../core/types/Player";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHandshake } from "@fortawesome/free-solid-svg-icons";
import { getElectricityTooltip, getTaxTooltip } from "../uiHelpers";
import { PlayerState } from "../../core/enums/PlayerState";
import useGameStateStore from "../stores/gameStateStore";

interface Props {
  tradeWithPlayer: (player: Player) => void;
}

export const StatsDialog: React.FC<Props> = ({ tradeWithPlayer }) => {

  const gameState = useGameStateStore(state => state.data);
  const statsViewOpen = useGameStateStore(state => state.statsViewOpen);
  const setStatsViewOpen = useGameStateStore(state => state.setStatsViewOpen);


  const getPlayerById = (params: GridRenderCellParams) => {
    if (gameState) {
      const playerId = String(params.row.id);
      return gameState.players.find((p: Player) => areObjectIdsEqual(p._id, playerId));
    }
    return null;
  }

  const canOfferTrade = (params: GridRenderCellParams) => {
    const uid = getMyUserId();
    const player = getPlayerById(params);
    if (player && areObjectIdsEqual(player._id, uid)) {
      return false;
    }
    if (player && player.state === PlayerState.BANKRUPT) {
      return false;
    }
    return uid && gameState && gameState.nextPlayerToAct && areObjectIdsEqual(uid, gameState.nextPlayerToAct) && gameState.auctionId == null;
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
      field: 'playerName', headerName: 'Player', type: 'string', flex: 1,
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
      field: 'money',
      headerName: 'Money',
      type: 'number',
      flex: 0.5,
      valueFormatter: (value: number) => dollarFormatter.format(value),
    },
    {
      field: 'taxPerTurn',
      headerName: 'Tax',
      type: 'number',
      flex: 0.5,
      renderCell: (params: GridRenderCellParams) => (
        <div style={{ textAlign: "right", width: "100%" }}>
          {getTaxTooltip(gameState, getPlayerById(params)!, dollarFormatter.format((params.value as number)))}
        </div>
      ),
    },
    {
      field: 'electricityPerTurn',
      headerName: 'Electric',
      type: 'number',
      flex: 0.5,
      renderCell: (params: GridRenderCellParams) => (
        <div style={{ textAlign: "right", width: "100%" }}>
          {getElectricityTooltip(gameState, getPlayerById(params)!, dollarFormatter.format((params.value as number)))}
        </div>
      ),
    },
    {
      field: 'totalAssets',
      headerName: 'Assets',
      type: 'number',
      flex: 0.5,
      valueFormatter: (value: number) => dollarFormatter.format(value),
    },
    {
      field: 'mortgageableValue',
      headerName: 'Mortgageable',
      type: 'number',
      flex: 1,
      valueFormatter: (value: number) => dollarFormatter.format(value),
    },
    {
      field: 'redeemableValue',
      headerName: 'Redeemable',
      type: 'number',
      flex: 1,
      valueFormatter: (value: number) => dollarFormatter.format(value),
    },
    {
      field: 'trade',
      headerName: 'Trade',
      flex: 0.5,
      renderCell: (params: GridRenderCellParams) => (
        <React.Fragment>
          {canOfferTrade(params) ? <FontAwesomeIcon icon={faHandshake} onClick={() => { tradeWithPlayer(getPlayerById(params)!); setStatsViewOpen(false); }} /> : null}
        </React.Fragment>
      )
    },
  ];


  const getDataRows = (): GridRowsProp => {
    if (!gameState) {
      return [];
    }


    const rows: Array<GridRowModel> = [];
    gameState.players.forEach((p: Player, key: number) => {
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
    <Dialog fullWidth={true} maxWidth="xl" onClose={() => setStatsViewOpen(false)} aria-labelledby="stats-dialog-title" open={statsViewOpen}>
      <DialogTitle id="stats-dialog-title">Stats</DialogTitle>
      <DialogContent>
        <div style={{ height: 400, width: '100%' }}>
          <DataGrid rows={getDataRows()} columns={columns} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }} pageSizeOptions={[10]} autoHeight={true} density="compact"
            disableColumnMenu={true} disableColumnSelector={true}
            disableRowSelectionOnClick={true} hideFooter={true} hideFooterPagination={true} checkboxSelection={false} />
        </div>

      </DialogContent>
      <DialogActions>
        <Button onClick={() => setStatsViewOpen(false)} color="primary">Cancel</Button>
      </DialogActions>
    </Dialog>
  );

};
