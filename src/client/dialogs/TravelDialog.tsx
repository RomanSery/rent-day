import React from "react";
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
import { Player } from "../../core/types/Player";
import { muggingAmount, muggingChance } from "../../core/constants";
import useGameStateStore from "../gameStateStore";


interface Props {
  open: boolean;
  onClose: () => void;
  onCancel: () => void;
  socketService: SocketService;
}

export const TravelDialog: React.FC<Props> = ({ open, onClose, onCancel, socketService }) => {

  const context: GameContext = getGameContextFromLocalStorage();
  const gameState = useGameStateStore(state => state.data);

  const onTravel = (squareId: number) => () => {
    API.post("actions/travel", { context, squareId: squareId })
      .then(function (response) {
        if (socketService && gameState) {
          socketService.socket.emit(GameEvent.STOP_ANIMATE_DICE, gameState._id, response.data.playerId, response.data.diceRoll, response.data.frames);
        }
        onClose();
      })
      .catch(handleApiError);
  };

  const getMyPlayer = (): Player | undefined => {
    if (gameState) {
      return gameState.players.find((p: Player) => areObjectIdsEqual(p._id, getMyUserId()));
    }
    return undefined;
  }

  const getPlayerTrainStations = (): number[] => {

    const playerId = getMyUserId();
    if (!playerId || !gameState) {
      return [];
    }
    const myPlayer = getMyPlayer();
    if (!myPlayer) {
      return [];
    }

    const stations: SquareGameData[] = gameState.squareState.filter((s: SquareGameData) => {
      const config = SquareConfigDataMap.get(s.squareId);
      return config && s.owner && areObjectIdsEqual(s.owner, playerId)
        && config.type === SquareType.TrainStation && !s.isMortgaged && s.squareId !== myPlayer.position;
    });

    return stations.map(function (p) {
      return p.squareId;
    });
  };


  return (
    <Dialog fullWidth={true} maxWidth="sm" onClose={onCancel} aria-labelledby="travel-dialog-title" open={open}>
      <DialogTitle id="travel-dialog-title">Select station to travel to</DialogTitle>
      <DialogContent>
        <p>
          <strong>CAUTION:</strong>
          <br />
          The city subway system is dangerous.  <br />
          If you travel, there is a <b>{muggingChance}%</b> of you being mugged and lossing <b>${muggingAmount}</b>.
        </p>
        <Grid container spacing={2} justify="center" alignItems="center" className="trade-dialog-cont">
          <Grid className="trade-left" item>
            <Paper>
              <List dense disablePadding component="div" role="list">

                {getPlayerTrainStations().map((squareId: number) => {
                  return (
                    <ListItem key={squareId} role="listitem" button onClick={onTravel(squareId)} className="trade-item">
                      <ListItemText primary={getSquareTxt(gameState, squareId)} />
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
        <Button onClick={onCancel} color="primary">Cancel</Button>
      </DialogActions>
    </Dialog>
  );

};
