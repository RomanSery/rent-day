import React from "react";
import { GameState } from "../../core/types/GameState";
import DialogTitle from '@material-ui/core/DialogTitle';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import Button from '@material-ui/core/Button';


interface Props {
  open: boolean;
  gameInfo: GameState | undefined;
  onClose: () => void;
  eliminationMsg: string;
}

export const EliminationDialog: React.FC<Props> = ({ open, gameInfo, onClose, eliminationMsg }) => {

  return (
    <Dialog fullWidth={true} maxWidth="sm" onClose={onClose} aria-labelledby="elimination-dialog-title" open={open}>
      <DialogTitle id="elimination-dialog-title">Elimination</DialogTitle>
      <DialogContent>
        <h1>{eliminationMsg}</h1>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">Close</Button>
      </DialogActions>
    </Dialog>
  );

};
