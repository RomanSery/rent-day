import React from "react";
import DialogTitle from '@material-ui/core/DialogTitle';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import Button from '@material-ui/core/Button';
import { areObjectIdsEqual, dollarFormatter, getIconProp } from "../helpers";
import Grid from '@material-ui/core/Grid';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Paper from '@material-ui/core/Paper';
import { ListSubheader } from "@material-ui/core";
import { Player } from "../../core/types/Player";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { getSquareTxt } from "../squares/squareHelpers";
import { TradeStatus } from "../../core/enums/TradeStatus";
import useGameStateStore from "../stores/gameStateStore";


interface Props {

}

export const TradeOfferReviewedDialog: React.FC<Props> = () => {

  const gameState = useGameStateStore(state => state.data);
  const tradeOffer = useGameStateStore(state => state.tradeOffer);
  const tradeReviewedOpen = useGameStateStore(state => state.tradeReviewedOpen);
  const setTradeReviewedOpen = useGameStateStore(state => state.setTradeReviewedOpen);


  const getPlayerHeader = (mine: boolean): React.ReactElement => {
    if (!gameState || !tradeOffer) {
      return <div></div>;
    }

    const playerId = mine ? tradeOffer.participant1.playerId : tradeOffer.participant2.playerId;
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

  const getResultHeadline = () => {
    if (tradeOffer) {
      return tradeOffer.status === TradeStatus.ACCEPTED ? "Blockbuster Trade Accepted" : "Trade Declined";
    }
    return "Trade Results";
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
            <ListItemText primary={mine ? dollarFormatter.format(tradeOffer.participant1.amountGiven) : dollarFormatter.format(tradeOffer.participant2.amountGiven)} />
          </ListItem>

          {items.map((squareId: number) => {
            const labelId = `transfer-list-item-${squareId}-label`;

            return (
              <ListItem key={squareId} role="listitem" className="trade-item">
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
    <Dialog fullWidth={true} maxWidth="sm" onClose={() => setTradeReviewedOpen(false)} aria-labelledby="reviewed-trade-dialog-title" open={tradeReviewedOpen}>
      <DialogTitle id="reviewed-trade-dialog-title">{getResultHeadline()}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} justify="center" alignItems="center" className="trade-dialog-cont">
          <Grid className="trade-left" item>{propertyList(true)}</Grid>
          <Grid className="trade-right" item>{propertyList(false)}</Grid>
        </Grid>

      </DialogContent>
      <DialogActions>
        <Button onClick={() => setTradeReviewedOpen(false)} color="primary">Close</Button>
      </DialogActions>
    </Dialog>
  );

};
