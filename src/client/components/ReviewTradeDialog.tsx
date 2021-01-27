import React from "react";
import { GameState } from "../../core/types/GameState";
import DialogTitle from '@material-ui/core/DialogTitle';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import Button from '@material-ui/core/Button';
import API from '../api';
import { getGameContextFromLocalStorage, handleApiError, areObjectIdsEqual, getIconProp } from "../helpers";
import { GameContext } from "../../core/types/GameContext";
import Grid from '@material-ui/core/Grid';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Paper from '@material-ui/core/Paper';
import { ListSubheader } from "@material-ui/core";
import { Player } from "../../core/types/Player";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { SocketService } from "../sockets/SocketService";
import { TradeOffer } from "../../core/types/TradeOffer";
import { getSquareTxt } from "../squares/squareHelpers";
import { GameEvent } from "../../core/types/GameEvent";


interface Props {
  open: boolean;
  gameInfo: GameState | undefined;
  onClose: () => void;
  tradeOffer: TradeOffer | null;
  socketService: SocketService;
}

export const ReviewTradeDialog: React.FC<Props> = ({ open, gameInfo, onClose, tradeOffer, socketService }) => {

  const context: GameContext = getGameContextFromLocalStorage();

  const onAcceptTrade = () => {
    if (!tradeOffer) {
      return;
    }

    API.post("actions/acceptTrade", { context, tradeId: tradeOffer._id })
      .then(function (response) {
        if (socketService) {
          socketService.socket.emit(GameEvent.TRADE_OFFER_ACCEPTED, response.data.newTradeId);
        }
        onClose();
      })
      .catch(handleApiError);
  };

  const onDeclineTrade = () => {
    if (!tradeOffer) {
      return;
    }

    API.post("actions/declineTrade", { context, tradeId: tradeOffer._id })
      .then(function (response) {
        onClose();
      })
      .catch(handleApiError);
  };


  const getPlayerHeader = (mine: boolean): React.ReactElement => {
    if (!gameInfo || !tradeOffer) {
      return <div></div>;
    }

    const playerId = mine ? tradeOffer.participant1.playerId : tradeOffer.participant2.playerId;
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

  const propertyList = (mine: boolean) => {
    if (!tradeOffer) {
      return null;
    }

    const items: number[] = mine ? tradeOffer.participant1.squaresGiven : tradeOffer.participant2.squaresGiven;

    return (
      <Paper>
        <List dense disablePadding component="div" role="list" subheader={getPlayerHeader(mine)}>

          <ListItem key={"moneyGiven" + (mine ? 1 : 0)} role="listitem" className="trade-item">
            <ListItemText primary={mine ? "$" + tradeOffer.participant1.amountGiven : "$" + tradeOffer.participant2.amountGiven} />
          </ListItem>

          {items.map((squareId: number) => {
            const labelId = `transfer-list-item-${squareId}-label`;

            return (
              <ListItem key={squareId} role="listitem" className="trade-item">
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
    <Dialog fullWidth={true} maxWidth="sm" onClose={onClose} disableBackdropClick={true} disableEscapeKeyDown={true} aria-labelledby="trade-dialog-title" open={open}>
      <DialogTitle id="trade-dialog-title">Accept/Decline Trade Offer</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} justify="center" alignItems="center" className="trade-dialog-cont">
          <Grid className="trade-left" item>{propertyList(true)}</Grid>
          <Grid className="trade-right" item>{propertyList(false)}</Grid>
        </Grid>

      </DialogContent>
      <DialogActions>
        <Button onClick={onDeclineTrade} color="primary">Decline</Button>
        <Button onClick={onAcceptTrade} color="primary">Accept</Button>
      </DialogActions>
    </Dialog>
  );

};
