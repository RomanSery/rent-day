import React from "react";
import DialogTitle from '@material-ui/core/DialogTitle';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import Button from '@material-ui/core/Button';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSmile, faFrownOpen } from "@fortawesome/free-regular-svg-icons";
import useGameStateStore from "../stores/gameStateStore";

interface Props {

}

export const ChanceEventDialog: React.FC<Props> = () => {

  const chanceOpen = useGameStateStore(state => state.chanceOpen);
  const chanceEvent = useGameStateStore(state => state.chanceEvent);
  const setChanceOpen = useGameStateStore(state => state.setChanceOpen);

  const getChanceCard = () => {
    if (!chanceEvent) {
      return null;
    }

    return (
      <div className="chance-event-info">
        <div className="type">
          <FontAwesomeIcon icon={chanceEvent.isGood ? faSmile : faFrownOpen} size="3x" />
        </div>
        <div className="chance-txt">
          <div className="headline">{chanceEvent.headline}</div>
          <div className="sub-line" dangerouslySetInnerHTML={{ __html: chanceEvent.subLine }}></div>
        </div>
      </div>
    );
  };


  return (
    <Dialog fullWidth={true} maxWidth="sm" onClose={() => setChanceOpen(false)} aria-labelledby="chance-dialog-title" open={chanceOpen}>
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
