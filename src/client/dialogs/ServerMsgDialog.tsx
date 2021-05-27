import React from "react";
import DialogTitle from '@material-ui/core/DialogTitle';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import Button from '@material-ui/core/Button';
import useGameStateStore from "../gameStateStore";

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
