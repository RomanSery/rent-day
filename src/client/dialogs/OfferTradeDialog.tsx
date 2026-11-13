import React from "react";
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Button from '@mui/material/Button';
import API from '../api';
import { getGameContextFromLocalStorage, getMyUserId, handleApiError, areObjectIdsEqual } from "../helpers";
import { GameContext } from "../../core/types/GameContext";
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import Checkbox from '@mui/material/Checkbox';
import { SquareGameData } from "../../core/types/SquareGameData";
import { InputAdornment, TextField } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowDown, faArrowUp } from "@fortawesome/free-solid-svg-icons";
import { GameEvent } from "../../core/types/GameEvent";
import { SocketService } from "../sockets/SocketService";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { SquareConfigData } from "../../core/types/SquareConfigData";
import { SquareType } from "../../core/enums/SquareType";
import useGameStateStore from "../stores/gameStateStore";
import useTradeStateStore from "../stores/tradeStateStore";
import { TradePlayer, TradeSquare } from "./TradeSummary";


interface Props {
  socketService: SocketService;
}

export const OfferTradeDialog: React.FC<Props> = ({ socketService }) => {

  const context: GameContext = getGameContextFromLocalStorage();

  const myChecked = useTradeStateStore(state => state.myChecked);
  const setMyChecked = useTradeStateStore(state => state.setMyChecked);
  const theirChecked = useTradeStateStore(state => state.theirChecked);
  const setTheirChecked = useTradeStateStore(state => state.setTheirChecked);
  const myAmount = useTradeStateStore(state => state.myAmount);
  const setMyAmount = useTradeStateStore(state => state.setMyAmount);
  const theirAmount = useTradeStateStore(state => state.theirAmount);
  const setTheirAmount = useTradeStateStore(state => state.setTheirAmount);
  const clearTrade = useTradeStateStore(state => state.clear);

  const gameState = useGameStateStore(state => state.data);
  const offerTradeOpen = useGameStateStore(state => state.offerTradeOpen);
  const tradingWithPlayerId = useGameStateStore(state => state.tradingWithPlayerId);
  const setOfferTradeOpen = useGameStateStore(state => state.setOfferTradeOpen);  

  const onOfferTrade = () => {

    API.post("actions/offerTrade", {
      context, mines: myChecked, theirs: theirChecked,
      tradingWithPlayerId: tradingWithPlayerId, myAmount: myAmount, theirAmount: theirAmount
    })
      .then(function (response) {
        if (socketService) {
          socketService.socket.emit(GameEvent.SEND_TRADE_OFFER, response.data.newTradeId);
        }
        closeDialog();
      })
      .catch(handleApiError);

  };

  const getPlayerTradeableProperties = (mine: boolean): number[] => {

    const playerId = mine ? getMyUserId() : tradingWithPlayerId;
    if (!playerId || !gameState) {
      return [];
    }

    const properties: SquareGameData[] = gameState.squareState.filter((s: SquareGameData) => {
      const squareConfig = SquareConfigDataMap.get(s.squareId);
      if (squareConfig) {
        const type = squareConfig.type;
        const isTradeable = type === SquareType.Property || type === SquareType.TrainStation || type === SquareType.Utility;
        if (!isTradeable) {
          return false;
        }

        if (squareConfig.groupId) {
          return s.owner && areObjectIdsEqual(s.owner, playerId) && s.numHouses === 0 && squareConfig.groupId && !doesGroupHaveAnyHouses(squareConfig.groupId);
        } else {
          return s.owner && areObjectIdsEqual(s.owner, playerId);
        }
      }
      return false;
    });

    return properties.map(function (p) {
      return p.squareId;
    });
  };


  const doesGroupHaveAnyHouses = (groupId: number): boolean => {
    if (!gameState) {
      return false;
    }
    let hasHouses = false;
    SquareConfigDataMap.forEach((d: SquareConfigData, key: number) => {
      if (d.groupId && d.groupId === groupId) {
        const squareData: SquareGameData | undefined = gameState.squareState.find(
          (p: SquareGameData) => p.squareId === key
        );

        if (squareData && squareData.numHouses > 0) {
          hasHouses = true;
          return;
        }
      }
    });

    return hasHouses;
  };

  const handleToggle = (mine: boolean, value: number) => () => {
    const currentIndex = mine ? myChecked.indexOf(value) : theirChecked.indexOf(value);
    const newChecked = mine ? [...myChecked] : [...theirChecked];

    if (currentIndex === -1) {
      newChecked.push(value);
    } else {
      newChecked.splice(currentIndex, 1);
    }

    if (mine) {
      setMyChecked(newChecked);
    } else {
      setTheirChecked(newChecked);
    }
  };

  const closeDialog = () => {
    setOfferTradeOpen(false);
    clearTrade();
  }

  const toAmount = (raw: string) => {
    const n = parseInt(raw);
    return Number.isNaN(n) || n < 0 ? 0 : n;
  };

  /** one side of the offer: cash plus checkboxes for the tradeable squares */
  const side = (mine: boolean) => {
    const items: number[] = getPlayerTradeableProperties(mine);
    const checked = mine ? myChecked : theirChecked;
    const amount = mine ? myAmount : theirAmount;

    return (
      <div className={"trade-side " + (mine ? "give" : "get")}>
        <div className="trade-side-head">
          <FontAwesomeIcon icon={mine ? faArrowUp : faArrowDown} />
          {mine ? "You give" : "You ask for"}
        </div>

        <TextField size="small" fullWidth label="Cash" type="number" name={mine ? "myAmount" : "theirAmount"}
          value={amount ? amount : ""}
          onChange={(e) => mine ? setMyAmount(toAmount(e.currentTarget.value)) : setTheirAmount(toAmount(e.currentTarget.value))}
          slotProps={{
            htmlInput: { min: 0, step: 10 },
            input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
          }}
          sx={{ mb: 1 }} />

        {items.length === 0
          ? <div className="trade-nothing">No properties to trade</div>
          : <List dense disablePadding>
            {items.map((squareId: number) => (
              <ListItemButton key={squareId} onClick={handleToggle(mine, squareId)} className="trade-pick" dense>
                <Checkbox edge="start" size="small" checked={checked.indexOf(squareId) !== -1} tabIndex={-1} disableRipple />
                <TradeSquare squareId={squareId} />
              </ListItemButton>
            ))}
          </List>}
      </div>
    );
  };

  const nothingInDeal = myChecked.length === 0 && theirChecked.length === 0 && !myAmount && !theirAmount;

  return (
    <Dialog fullWidth={true} maxWidth="sm" onClose={() => closeDialog()} aria-labelledby="offer-trade-dialog-title" open={offerTradeOpen}>
      <DialogTitle id="offer-trade-dialog-title">
        Trade with {tradingWithPlayerId ? <TradePlayer playerId={tradingWithPlayerId} /> : null}
      </DialogTitle>
      <DialogContent>
        <div className="trade-summary">
          {side(true)}
          {side(false)}
        </div>
        <p className="trade-hint">Properties in a colour group with houses can't be traded.</p>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => closeDialog()} color="inherit">Cancel</Button>
        <Button onClick={onOfferTrade} variant="contained" color="primary" disabled={nothingInDeal}>Offer trade</Button>
      </DialogActions>
    </Dialog>
  );

};
