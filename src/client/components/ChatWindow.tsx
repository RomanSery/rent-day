
import { faPaperPlane } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button, ButtonGroup, InputAdornment, PropTypes, TextField } from "@material-ui/core";
import React from "react";
import { ChatMsg } from "../../core/types/ChatMsg";
import { GameEvent } from "../../core/types/GameEvent";
import { newChatMsgSound } from "../gameSounds";
import useGameStateStore from "../gameStateStore";
import { getMyPlayerName } from "../helpers";
import { SocketService } from '../sockets/SocketService';

interface Props {
  socketService: SocketService;
}

export const ChatWindow: React.FC<Props> = ({ socketService }) => {

  const [sendChatMsg, setSendChatMsg] = React.useState<string | undefined>();
  const [showChat, setShowChat] = React.useState<boolean>(true);

  const gameState = useGameStateStore(state => state.data);

  React.useEffect(() => {
    socketService.listenForEvent(GameEvent.NEW_CHAT_MSG, (msg: ChatMsg) => {
      setShowChat(true);
      appendToChatWindow(msg);

      const ul = document.getElementById("chat-window-ul");
      if (ul) {
        ul.scrollIntoView(false);
      }

      newChatMsgSound.play();
    });
  }, [socketService]);


  const onChangeChatMsg = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>): void => {
    setSendChatMsg(e.currentTarget.value);
  };

  const sendChatEvent = () => {
    if (gameState && sendChatMsg && getMyPlayerName()) {

      const newMsg: ChatMsg = {
        msg: sendChatMsg,
        player: getMyPlayerName()!
      };

      socketService.socket.emit(GameEvent.SEND_CHAT_MSG, gameState._id, newMsg);
      setSendChatMsg("");
      appendToChatWindow(newMsg);
    }
  }

  const appendToChatWindow = (msg: ChatMsg) => {
    const ul = document.getElementById("chat-window-ul");
    if (ul) {
      const li = document.createElement("li");
      li.innerHTML = "<b>" + msg.player + "</b> - " + msg.msg;
      ul.appendChild(li);
    }
  }

  const getChatContStyle = (): React.CSSProperties => {
    if (!showChat) {
      return { display: "none" };
    }
    return {};
  };
  const getChatBtnColor = (): PropTypes.Color => {
    if (showChat) {
      return "primary";
    }
    return "default";
  }

  const getLogBtnColor = (): PropTypes.Color => {
    if (!showChat) {
      return "primary";
    }
    return "default";
  }

  const getLogContStyle = (): React.CSSProperties => {
    if (showChat) {
      return { display: "none" };
    }
    return {};
  };

  const getChatWindow = () => {



    return (
      <React.Fragment>
        <ButtonGroup size="small" color="primary">
          <Button variant="contained" onClick={() => setShowChat(true)} color={getChatBtnColor()}>Chat</Button>
          <Button variant="contained" onClick={() => setShowChat(false)} color={getLogBtnColor()}>Game Log</Button>
        </ButtonGroup>

        <div className="chat-row" style={getChatContStyle()}>
          <div className="chat-messages">
            <ul id="chat-window-ul">
              {gameState?.messages.map((m, index) => (
                <li key={index}>
                  <b>{m.player}</b> - {m.msg}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="chat-row" style={getLogContStyle()}>
          <div className="chat-messages">
            <ul id="chat-window-ul">
              {gameState?.log.map((m, index) => (
                <li key={index} dangerouslySetInnerHTML={{ __html: m.msg }}>

                </li>
              ))}
            </ul>
          </div>
        </div>


        <TextField onChange={(e) => onChangeChatMsg(e)}
          onKeyPress={(ev) => {
            if (ev.key === 'Enter') {
              ev.preventDefault();
              sendChatEvent();
            }
          }}
          placeholder="Type Message" fullWidth={true} value={sendChatMsg} variant="outlined" InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <FontAwesomeIcon icon={faPaperPlane} size="2x" />
              </InputAdornment>
            ),
          }} />



      </React.Fragment>
    );
  }

  return (
    getChatWindow()
  );

};
