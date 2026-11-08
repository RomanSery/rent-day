import React from "react";
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Button from '@mui/material/Button';
import useGameStateStore from "../stores/gameStateStore";

interface Props {

}

export const ServerMsgDialog: React.FC<Props> = () => {

  const serverMsgModalOpen = useGameStateStore(state => state.serverMsgModalOpen);
  const serverMsg = useGameStateStore(state => state.serverMsg);
  const setServerMsgModalOpen = useGameStateStore(state => state.setServerMsgModalOpen);

  const getMsgContent = () => {
    if (serverMsg) {
      return (
        <Dialog fullWidth={true} maxWidth="sm" onClose={() => setServerMsgModalOpen(false)} aria-labelledby="server-dialog-title" open={serverMsgModalOpen}>
          <DialogTitle id="server-dialog-title">{serverMsg.title}</DialogTitle>
          <DialogContent>
            <h1>{serverMsg.body}</h1>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setServerMsgModalOpen(false)} color="primary">Close</Button>
          </DialogActions>
        </Dialog>
      );
    }

    return null;
  }

  return (
    getMsgContent()
  );

};
