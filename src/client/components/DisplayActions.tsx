import React from "react";
import { Button, ButtonGroup, Container } from "@material-ui/core";
import { getGameContextFromLocalStorage, getMyGameId, getMyUserId, leaveCurrentGameIfJoined } from "../helpers";
import { GameState } from "../../core/types/GameState";
import { useHistory } from "react-router-dom";
import API from '../api';
import { GameContext } from "../../core/types/GameContext";
import { GameEvent } from "../../core/types/GameEvent";
import { SocketService } from "../sockets/SocketService";

interface Props {
  gameInfo: GameState | undefined;
  socketService: SocketService;
  onRollAction: () => void;
}

export const DisplayActions: React.FC<Props> = ({ gameInfo, socketService, onRollAction }) => {

  const context: GameContext = getGameContextFromLocalStorage();
  const history = useHistory();
  const [showRollBtn, setShowRollBtn] = React.useState(true);

  const onClickRoll = async () => {
    setShowRollBtn(false);
    onRollAction();
  };

  const onClickDone = async () => {
    API.post("actions/completeTurn", { context })
      .then(function (response) {
        if (socketService) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, getMyGameId());
        }
        setTimeout(() => {
          setShowRollBtn(true);
        }, 500);

      })
      .catch(function (error) {
        if (error.response) {
          alert(error.response.data);
        } else if (error.request) {
          console.log(error.request);
        } else {
          console.log('Error', error.message);
        }
      });

  };

  const onLeaveGame = async () => {
    leaveCurrentGameIfJoined(() => {
      history.push("/");
    });
  };

  const isMyTurn = () => {
    return getMyUserId() === gameInfo?.nextPlayerToAct && gameInfo?.auctionId == null;
  }

  const getMyActions = () => {
    return (
      <Container maxWidth="sm">
        <ButtonGroup variant="contained" color="primary" aria-label="contained primary button group">
          {showRollBtn ? <Button color="primary" size="small" onClick={onClickRoll}>Roll dice</Button> : null}
          {!showRollBtn ? <Button color="primary" size="small" onClick={onClickDone}>Done</Button> : null}
          <Button color="primary" size="small">Build</Button>
          <Button color="primary" size="small">Sell</Button>
        </ButtonGroup>


        <ButtonGroup variant="contained" color="primary" aria-label="contained primary button group">
          <Button color="primary" size="small">Mortgage</Button>
          <Button color="primary" size="small">Redeem</Button>
          <Button color="secondary" onClick={onLeaveGame} size="small"> Leave Game</Button>
        </ButtonGroup>
      </Container>
    );
  }



  return (
    <React.Fragment>
      {isMyTurn() ? getMyActions() : null}
    </React.Fragment>
  );

};
