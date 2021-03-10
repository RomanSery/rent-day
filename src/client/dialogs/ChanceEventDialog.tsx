import React from "react";
import { GameState } from "../../core/types/GameState";
import DialogTitle from '@material-ui/core/DialogTitle';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import Button from '@material-ui/core/Button';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSmile, faFrownOpen } from "@fortawesome/free-regular-svg-icons";

interface Props {
  open: boolean;
  gameInfo: GameState | undefined;
  onClose: () => void;
}

export const ChanceEventDialog: React.FC<Props> = ({ open, gameInfo, onClose }) => {

  const getChanceCard = () => {
    if (!gameInfo || !gameInfo.results || !gameInfo.results.chance) {
      return null;
    }

    return (
      <div className="chance-event-info">
        <div className="type">
          <FontAwesomeIcon icon={gameInfo.results.chance.isGood ? faSmile : faFrownOpen} size="3x" />
        </div>
        <div className="chance-txt">
          <div className="headline">{gameInfo.results.chance.headline}</div>
          <div className="sub-line">{gameInfo.results.chance.subLine}</div>
        </div>
      </div>
    );
  };


  return (
    <Dialog fullWidth={true} maxWidth="sm" onClose={onClose} aria-labelledby="chance-dialog-title" open={open}>
      <DialogTitle id="chance-dialog-title">Chance Event</DialogTitle>
      <DialogContent>
        {getChanceCard()}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">Close</Button>
      </DialogActions>
    </Dialog>
  );

};
