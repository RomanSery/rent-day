import React from "react";
import { GameState } from "../../core/types/GameState";
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


interface Props {
  open: boolean;
  gameInfo: GameState | undefined;
  onClose: () => void;
  tradingWithPlayerId: string | null;
  socketService: SocketService;
}

export const OfferTradeDialog: React.FC<Props> = ({ open, gameInfo, onClose, tradingWithPlayerId, socketService }) => {

  const context: GameContext = getGameContextFromLocalStorage();
  const [myChecked, setMyChecked] = React.useState<number[]>([]);
  const [theirChecked, setTheirChecked] = React.useState<number[]>([]);
  const [myAmount, setMyAmount] = React.useState<number>(0);
  const [theirAmount, setTheirAmount] = React.useState<number>(0);

  const onOfferTrade = () => {

    API.post("actions/offerTrade", {
      context, mines: myChecked, theirs: theirChecked,
      tradingWithPlayerId: tradingWithPlayerId, myAmount: myAmount, theirAmount: theirAmount
    })
      .then(function (response) {
        if (socketService) {
          socketService.socket.emit(GameEvent.SEND_TRADE_OFFER, response.data.newTradeId);
        }
        onClose();
      })
      .catch(handleApiError);

  };

  const getPlayerTradeableProperties = (mine: boolean): number[] => {

    const playerId = mine ? getMyUserId() : tradingWithPlayerId;
    if (!playerId || !gameInfo) {
      return [];
    }

    const properties: SquareGameData[] = gameInfo.squareState.filter((s: SquareGameData) => {
      const squareConfig = SquareConfigDataMap.get(s.squareId);
      return s.owner && areObjectIdsEqual(s.owner, playerId) && s.numHouses === 0 &&
        squareConfig && squareConfig.groupId && !doesGroupHaveAnyHouses(squareConfig.groupId);
    });

    return properties.map(function (p) {
      return p.squareId;
    });
  };


  const doesGroupHaveAnyHouses = (groupId: number): boolean => {
    if (!gameInfo) {
      return false;
    }
    let hasHouses = false;
    SquareConfigDataMap.forEach((d: SquareConfigData, key: number) => {
      if (d.groupId && d.groupId === groupId) {
        const squareData: SquareGameData | undefined = gameInfo.squareState.find(
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
    if (!gameInfo) {
      return <div></div>;
    }

    const playerId = mine ? getMyUserId() : tradingWithPlayerId;
    const p = gameInfo.players.find((p: Player) => areObjectIdsEqual(p._id, playerId));
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
                <ListItemText id={labelId} primary={getSquareTxt(gameInfo, squareId)} />
              </ListItem>
            );
          })}
          <ListItem />
        </List>
      </Paper>
    );
  };

  return (
    <Dialog fullWidth={true} maxWidth="sm" onClose={onClose} aria-labelledby="trade-dialog-title" open={open}>
      <DialogTitle id="trade-dialog-title">Trade</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} justify="center" alignItems="center" className="trade-dialog-cont">
          <Grid className="trade-left" item>{propertyList(true)}</Grid>
          <Grid className="trade-right" item>{propertyList(false)}</Grid>
        </Grid>

      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">Cancel</Button>
        <Button onClick={onOfferTrade} color="primary">Offer Trade</Button>
      </DialogActions>
    </Dialog>
  );

};
