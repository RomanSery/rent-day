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
import { ListSubheader } from "@material-ui/core";
import { Player } from "../../core/types/Player";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";


interface Props {
  open: boolean;
  gameInfo: GameState | undefined;
  onClose: () => void;
  tradingWithPlayerId: string | null;
}

export const TradeDialog: React.FC<Props> = ({ open, gameInfo, onClose, tradingWithPlayerId }) => {

  const context: GameContext = getGameContextFromLocalStorage();
  const [checked, setChecked] = React.useState<number[]>([]);

  const onOfferTrade = () => {

    API.post("actions/offerTrade", { context })
      .then(function (response) {

      })
      .catch(handleApiError);

  };

  const getPlayerProperties = (mine: boolean): number[] => {

    const playerId = mine ? getMyUserId() : tradingWithPlayerId;
    if (!playerId || !gameInfo) {
      return [];
    }

    const properties: SquareGameData[] = gameInfo.squareState.filter((s: SquareGameData) => {
      return s.owner && areObjectIdsEqual(s.owner, playerId);
    });

    return properties.map(function (p) {
      return p.squareId;
    });
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


  const handleToggle = (value: number) => () => {
    const currentIndex = checked.indexOf(value);
    const newChecked = [...checked];

    if (currentIndex === -1) {
      newChecked.push(value);
    } else {
      newChecked.splice(currentIndex, 1);
    }

    setChecked(newChecked);
  };

  const propertyList = (mine: boolean) => {
    const items: number[] = getPlayerProperties(mine);

    return (
      <Paper>
        <List dense disablePadding component="div" role="list" subheader={getPlayerHeader(mine)}>
          {items.map((squareId: number) => {
            const labelId = `transfer-list-item-${squareId}-label`;

            return (
              <ListItem key={squareId} role="listitem" button onClick={handleToggle(squareId)} className="trade-item">
                <ListItemIcon>
                  <Checkbox tabIndex={-1} disableRipple inputProps={{ 'aria-labelledby': labelId }} />
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
