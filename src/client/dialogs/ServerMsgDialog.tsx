import React from "react";
import DialogTitle from '@material-ui/core/DialogTitle';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import Button from '@material-ui/core/Button';
import { ServerMsg } from "../../core/types/ServerMsg";


interface Props {
  open: boolean;
  onClose: () => void;
  msg: ServerMsg | undefined;
}

export const ServerMsgDialog: React.FC<Props> = ({ open, onClose, msg }) => {

  const getMsgContent = () => {
    if (msg) {
      return (
        <Dialog fullWidth={true} maxWidth="sm" onClose={onClose} aria-labelledby="server-dialog-title" open={open}>
          <DialogTitle id="server-dialog-title">{msg.title}</DialogTitle>
          <DialogContent>
            <h1>{msg.body}</h1>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} color="primary">Close</Button>
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
