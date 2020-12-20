import React from "react";
import { Button, ButtonGroup } from "@material-ui/core";
import { getMyPlayerId, leaveCurrentGameIfJoined } from "../helpers";
import { GameState } from "../../core/types/GameState";
import { useHistory } from "react-router-dom";
import { SocketService } from "../sockets/SocketService";

interface Props {
  gameInfo: GameState | undefined;
  socketService: SocketService;
  onRollAction: () => void;
}

export const DisplayActions: React.FC<Props> = ({ gameInfo, socketService, onRollAction }) => {

  const history = useHistory();
  const [showRollBtn, setShowRollBtn] = React.useState(true);

  const onClickRoll = async () => {
    setShowRollBtn(false);
    onRollAction();

    setTimeout(() => {
      setShowRollBtn(true);
    }, 5000);
  };

  const onLeaveGame = async () => {
    leaveCurrentGameIfJoined(() => {
      history.push("/");
    });
  };

  const isMyTurn = () => {
    return getMyPlayerId() == gameInfo?.nextPlayerToAct;
  }

  const getMyActions = () => {
    return (
      <React.Fragment>

        <ButtonGroup variant="contained" color="primary" aria-label="contained primary button group">
          {showRollBtn ? <Button color="primary" onClick={onClickRoll}>Roll dice</Button> : null}
          <Button color="primary">Build</Button>
          <Button color="primary">Sell</Button>
        </ButtonGroup>

        <br></br>

        <ButtonGroup variant="contained" color="primary" aria-label="contained primary button group">
          <Button color="primary">Mortgage</Button>
          <Button color="primary">Redeem</Button>
          <Button color="secondary" onClick={onLeaveGame}> Leave Game</Button>
        </ButtonGroup>

      </React.Fragment>
    );
  }



  return (
    <React.Fragment>

      {isMyTurn() && getMyActions()}

    </React.Fragment>
  );

};
