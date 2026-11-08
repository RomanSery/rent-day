import React from "react";
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Button from '@mui/material/Button';
import API from '../api';
import { getGameContextFromLocalStorage, getMyUserId, handleApiError, areObjectIdsEqual } from "../helpers";
import { GameContext } from "../../core/types/GameContext";
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import { SquareGameData } from "../../core/types/SquareGameData";
import { getSquareTxt } from "../squares/squareHelpers";
import { GameEvent } from "../../core/types/GameEvent";
import { SocketService } from "../sockets/SocketService";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { SquareType } from "../../core/enums/SquareType";
import { Player } from "../../core/types/Player";
import { muggingAmount, muggingChance } from "../../core/constants";
import useGameStateStore from "../stores/gameStateStore";


interface Props {
  socketService: SocketService;
}

export const TravelDialog: React.FC<Props> = ({ socketService }) => {

  const context: GameContext = getGameContextFromLocalStorage();
  const gameState = useGameStateStore(state => state.data);
  const travelOpen = useGameStateStore(state => state.travelOpen);
  const setTravelOpen = useGameStateStore(state => state.setTravelOpen);

  const onTravel = (squareId: number) => () => {
    API.post("actions/travel", { context, squareId: squareId })
      .then(function (response) {
        if (socketService && gameState) {
          socketService.socket.emit(GameEvent.STOP_ANIMATE_DICE, gameState._id, response.data.playerId, response.data.diceRoll, response.data.frames);
        }
        setTravelOpen(false);
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
    <Dialog fullWidth={true} maxWidth="sm" onClose={() => setTravelOpen(false)} aria-labelledby="travel-dialog-title" open={travelOpen}>
      <DialogTitle id="travel-dialog-title">Select station to travel to</DialogTitle>
      <DialogContent>
        <p>
          <strong>CAUTION:</strong>
          <br />
          The city subway system is dangerous.  <br />
          If you travel, there is a <b>{muggingChance}%</b> of you being mugged and lossing <b>${muggingAmount}</b>.
        </p>
        <Grid container spacing={2} justifyContent="center" alignItems="center" className="trade-dialog-cont">
          <Grid className="trade-left">
            <Paper>
              <List dense disablePadding component="div" role="list">

                {getPlayerTrainStations().map((squareId: number) => {
                  return (
                    <ListItemButton key={squareId} role="listitem" onClick={onTravel(squareId)} className="trade-item">
                      <ListItemText primary={getSquareTxt(gameState, squareId)} />
                    </ListItemButton>
                  );
                })}
                <ListItem />
              </List>
            </Paper>
          </Grid>
        </Grid>

      </DialogContent>
      <DialogActions>
        <Button onClick={() => setTravelOpen(false)} color="primary">Cancel</Button>
      </DialogActions>
    </Dialog>
  );

};
