import React from "react";
import DialogTitle from '@material-ui/core/DialogTitle';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import Button from '@material-ui/core/Button';
import API from '../api';
import { getGameContextFromLocalStorage, getMyUserId, handleApiError, areObjectIdsEqual, getIconProp } from "../helpers";
import { GameContext } from "../../core/types/GameContext";
import Grid from '@material-ui/core/Grid';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Checkbox from '@material-ui/core/Checkbox';
import Paper from '@material-ui/core/Paper';
import { SquareGameData } from "../../core/types/SquareGameData";
import { getSquareTxt } from "../squares/squareHelpers";
import { ListSubheader, TextField } from "@material-ui/core";
import { Player } from "../../core/types/Player";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { GameEvent } from "../../core/types/GameEvent";
import { SocketService } from "../sockets/SocketService";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { SquareConfigData } from "../../core/types/SquareConfigData";
import { SquareType } from "../../core/enums/SquareType";
import useGameStateStore from "../stores/gameStateStore";
import useTradeStateStore from "../stores/tradeStateStore";


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
        setOfferTradeOpen(false);
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

  const getPlayerHeader = (mine: boolean): React.ReactElement => {
    if (!gameState) {
      return <div></div>;
    }

    const playerId = mine ? getMyUserId() : tradingWithPlayerId;
    const p = gameState.players.find((p: Player) => areObjectIdsEqual(p._id, playerId));
    if (!p) {
      return <div></div>;
    }


    return (
      <ListSubheader component="div" style={{ color: p.color }}>
        <FontAwesomeIcon icon={getIconProp(p.type)} size="2x" color={p.color} />
        &nbsp;&nbsp;
        {p.name}
      </ListSubheader>
    );
  }


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

  const propertyList = (mine: boolean) => {
    const items: number[] = getPlayerTradeableProperties(mine);

    return (
      <Paper>
        <List dense disablePadding component="div" role="list" subheader={getPlayerHeader(mine)}>

          <TextField label="Amount ($)" type="number"
            value={mine ? myAmount : theirAmount}
            onChange={(e) => mine ? setMyAmount(parseInt(e.currentTarget.value)) : setTheirAmount(parseInt(e.currentTarget.value))}
            name={mine ? "myAmount" : "theirAmount"} />

          {items.map((squareId: number) => {
            const labelId = `transfer-list-item-${squareId}-label`;

            return (
              <ListItem key={squareId} role="listitem" button onClick={handleToggle(mine, squareId)} className="trade-item">
                <ListItemIcon>
                  <Checkbox checked={mine ? (myChecked.indexOf(squareId) !== -1) : (theirChecked.indexOf(squareId) !== -1)} tabIndex={-1} disableRipple inputProps={{ 'aria-labelledby': labelId }} />
                </ListItemIcon>
                <ListItemText id={labelId} primary={getSquareTxt(gameState, squareId)} />
              </ListItem>
            );
          })}
          <ListItem />
        </List>
      </Paper>
    );
  };

  return (
    <Dialog fullWidth={true} maxWidth="sm" onClose={() => setOfferTradeOpen(false)} aria-labelledby="offer-trade-dialog-title" open={offerTradeOpen}>
      <DialogTitle id="offer-trade-dialog-title">Trade</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} justify="center" alignItems="center" className="trade-dialog-cont">
          <Grid className="trade-left" item>{propertyList(true)}</Grid>
          <Grid className="trade-right" item>{propertyList(false)}</Grid>
        </Grid>

      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOfferTradeOpen(false)} color="primary">Cancel</Button>
        <Button onClick={onOfferTrade} color="primary">Offer Trade</Button>
      </DialogActions>
    </Dialog>
  );

};
