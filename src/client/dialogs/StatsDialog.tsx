import React from "react";
import DialogTitle from '@material-ui/core/DialogTitle';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import Button from '@material-ui/core/Button';
import { areObjectIdsEqual, dollarFormatter, getIconProp, getMyUserId } from "../helpers";
import { DataGrid, GridColDef, GridRowsProp, GridRowModel, ValueFormatterParams } from '@material-ui/data-grid';
import { Player } from "../../core/types/Player";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHandshake } from "@fortawesome/free-solid-svg-icons";
import { getElectricityTooltip, getTaxTooltip } from "../uiHelpers";
import { PlayerState } from "../../core/enums/PlayerState";
import useGameStateStore from "../gameStateStore";

interface Props {
  open: boolean;
  onClose: () => void;
  tradeWithPlayer: (player: Player) => void;
}

export const StatsDialog: React.FC<Props> = ({ open, onClose, tradeWithPlayer }) => {

  const gameState = useGameStateStore(state => state.data);

  const getPlayerById = (params: ValueFormatterParams) => {
    if (gameState) {
      const playerId = params.getValue('id')?.toLocaleString();
      return gameState.players.find((p: Player) => areObjectIdsEqual(p._id, playerId));
    }
    return null;
  }

  const canOfferTrade = (params: ValueFormatterParams) => {
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
      field: 'playerName', headerName: 'Player', type: 'string', flex: 1,
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
      field: 'money',
      headerName: 'Money',
      type: 'number',
      flex: 0.5,
      valueFormatter: (params: ValueFormatterParams) =>
        dollarFormatter.format((params.value as number)),
    },
    {
      field: 'taxPerTurn',
      headerName: 'Tax',
      type: 'number',
      flex: 0.5,
      renderCell: (params: ValueFormatterParams) => (
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
      renderCell: (params: ValueFormatterParams) => (
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
      valueFormatter: (params: ValueFormatterParams) =>
        dollarFormatter.format((params.value as number)),
    },
    {
      field: 'mortgageableValue',
      headerName: 'Mortgageable',
      type: 'number',
      flex: 1,
      valueFormatter: (params: ValueFormatterParams) =>
        dollarFormatter.format((params.value as number)),
    },
    {
      field: 'redeemableValue',
      headerName: 'Redeemable',
      type: 'number',
      flex: 1,
      valueFormatter: (params: ValueFormatterParams) =>
        dollarFormatter.format((params.value as number)),
    },
    {
      field: 'trade',
      headerName: 'Trade',
      flex: 0.5,
      renderCell: (params: ValueFormatterParams) => (
        <React.Fragment>
          {canOfferTrade(params) ? <FontAwesomeIcon icon={faHandshake} onClick={() => { tradeWithPlayer(getPlayerById(params)!); onClose(); }} /> : null}
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
    <Dialog fullWidth={true} maxWidth="xl" onClose={onClose} aria-labelledby="stats-dialog-title" open={open}>
      <DialogTitle id="stats-dialog-title">Stats</DialogTitle>
      <DialogContent>
        <div style={{ height: 400, width: '100%' }}>
          <DataGrid rows={getDataRows()} columns={columns} pageSize={10} autoHeight={true} density="compact"
            disableColumnMenu={true} disableColumnSelector={true}
            disableSelectionOnClick={true} hideFooter={true} hideFooterPagination={true} checkboxSelection={false} />
        </div>

      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">Cancel</Button>
      </DialogActions>
    </Dialog>
  );

};
