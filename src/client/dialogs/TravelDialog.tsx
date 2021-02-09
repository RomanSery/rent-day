import React from "react";
import { GameState } from "../../core/types/GameState";
import DialogTitle from '@material-ui/core/DialogTitle';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import Button from '@material-ui/core/Button';
import API from '../api';
import { getGameContextFromLocalStorage, getMyUserId, handleApiError, areObjectIdsEqual } from "../helpers";
import { GameContext } from "../../core/types/GameContext";
import Grid from '@material-ui/core/Grid';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Paper from '@material-ui/core/Paper';
import { SquareGameData } from "../../core/types/SquareGameData";
import { getSquareTxt } from "../squares/squareHelpers";
import { GameEvent } from "../../core/types/GameEvent";
import { SocketService } from "../sockets/SocketService";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { SquareType } from "../../core/enums/SquareType";


interface Props {
  open: boolean;
  gameInfo: GameState | undefined;
  onClose: () => void;
  socketService: SocketService;
}

export const TravelDialog: React.FC<Props> = ({ open, gameInfo, onClose, socketService }) => {

  const context: GameContext = getGameContextFromLocalStorage();

  const onTravel = (squareId: number) => () => {
    API.post("actions/travel", { context, squareId: squareId })
      .then(function (response) {
        if (socketService) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameInfo?.id);
        }
        onClose();
      })
      .catch(handleApiError);
  };

  const getPlayerTrainStations = (): number[] => {

    const playerId = getMyUserId();
    if (!playerId || !gameInfo) {
      return [];
    }

    const stations: SquareGameData[] = gameInfo.squareState.filter((s: SquareGameData) => {
      const config = SquareConfigDataMap.get(s.squareId);
      return config && s.owner && areObjectIdsEqual(s.owner, playerId) && config.type === SquareType.TrainStation && !s.isMortgaged;
    });

    return stations.map(function (p) {
      return p.squareId;
    });
  };


  return (
    <Dialog fullWidth={true} maxWidth="sm" onClose={onClose} aria-labelledby="trade-dialog-title" open={open}>
      <DialogTitle id="trade-dialog-title">Select station to travel to</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} justify="center" alignItems="center" className="trade-dialog-cont">
          <Grid className="trade-left" item>
            <Paper>
              <List dense disablePadding component="div" role="list">

                {getPlayerTrainStations().map((squareId: number) => {
                  return (
                    <ListItem key={squareId} role="listitem" button onClick={onTravel(squareId)} className="trade-item">
                      <ListItemText primary={getSquareTxt(gameInfo, squareId)} />
                    </ListItem>
                  );
                })}
                <ListItem />
              </List>
            </Paper>
          </Grid>
        </Grid>

      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">Cancel</Button>
      </DialogActions>
    </Dialog>
  );

};
