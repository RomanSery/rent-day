import React from "react";
import DialogTitle from '@material-ui/core/DialogTitle';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import Button from '@material-ui/core/Button';
import { getHelpContent } from "../uiHelpers";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const HelpDialog: React.FC<Props> = ({ open, onClose }) => {

  return (
    <Dialog maxWidth="md" onClose={onClose} aria-labelledby="help-dialog-title" open={open}>
      <DialogTitle id="help-dialog-title">Help</DialogTitle>
      <DialogContent>
        <div style={{ height: 400, width: '80%' }}>

          {getHelpContent()}

        </div>

      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">Close</Button>
      </DialogActions>
    </Dialog>
  );

};
