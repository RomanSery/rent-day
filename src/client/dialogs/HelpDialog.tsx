import React from "react";
import DialogTitle from '@material-ui/core/DialogTitle';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import Button from '@material-ui/core/Button';
import { getHelpContent } from "../uiHelpers";
import useGameStateStore from "../stores/gameStateStore";

interface Props {

}

export const HelpDialog: React.FC<Props> = () => {

  const helpOpen = useGameStateStore(state => state.helpOpen);
  const setHelpOpen = useGameStateStore(state => state.setHelpOpen);

  return (
    <Dialog maxWidth="md" onClose={() => setHelpOpen(false)} aria-labelledby="help-dialog-title" open={helpOpen}>
      <DialogTitle id="help-dialog-title">Help</DialogTitle>
      <DialogContent>
        <div style={{ height: 400, width: '80%' }}>

          {getHelpContent()}

        </div>

      </DialogContent>
      <DialogActions>
        <Button onClick={() => setHelpOpen(false)} color="primary">Close</Button>
      </DialogActions>
    </Dialog>
  );

};
