import React from "react";
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Button from '@mui/material/Button';
import { HelpContent } from "../HelpContent";
import useGameStateStore from "../stores/gameStateStore";

export const HelpDialog: React.FC = () => {

  const helpOpen = useGameStateStore(state => state.helpOpen);
  const setHelpOpen = useGameStateStore(state => state.setHelpOpen);

  return (
    <Dialog maxWidth="md" fullWidth scroll="paper" onClose={() => setHelpOpen(false)} aria-labelledby="help-dialog-title" open={helpOpen}>
      <DialogTitle id="help-dialog-title">How to play</DialogTitle>
      <DialogContent dividers className="help-dialog-content">
        <HelpContent />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setHelpOpen(false)} color="primary">Close</Button>
      </DialogActions>
    </Dialog>
  );

};
