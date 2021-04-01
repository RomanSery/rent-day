
import { faPaperPlane } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { InputAdornment, TextField } from "@material-ui/core";
import React from "react";
import { ChatMsg } from "../../core/types/ChatMsg";
import { GameEvent } from "../../core/types/GameEvent";
import { GameState } from "../../core/types/GameState";
import { areObjectIdsEqual, getMyPlayerName, getMyUserId } from "../helpers";
import { SocketService } from '../sockets/SocketService';

interface Props {
  gameInfo: GameState | undefined;
  socketService: SocketService;
}

export const ChatWindow: React.FC<Props> = ({ gameInfo, socketService }) => {

  const [sendChatMsg, setSendChatMsg] = React.useState<string | undefined>();
  const [chatHistory, setChatHistory] = React.useState<Array<ChatMsg>>([]);

  React.useEffect(() => {
    socketService.listenForEvent(GameEvent.NEW_CHAT_MSG, (msg: string, playerId: string) => {
      const player = gameInfo && gameInfo.players.find((p) => areObjectIdsEqual(p._id, playerId));
      setChatHistory([
        ...chatHistory,
        {
          id: chatHistory.length,
          msg: msg,
          player: player ? player.name : ""
        }
      ]);

    });
  }, [chatHistory, gameInfo, socketService]);


  const onChangeChatMsg = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>): void => {
    setSendChatMsg(e.currentTarget.value);
  };

  const sendChatEvent = () => {
    socketService.socket.emit(GameEvent.SEND_CHAT_MSG, gameInfo?._id, sendChatMsg, getMyUserId());
    setSendChatMsg("");

    setChatHistory([
      ...chatHistory,
      {
        id: chatHistory.length,
        msg: sendChatMsg ? sendChatMsg : "",
        player: getMyPlayerName()!
      }
    ]);
  }

  return (

    <React.Fragment>
      <div className="chat-messages">
        <ul>
          <li>fewfewfew1</li>
          <li>fewfewfew1</li>
          <li>fewfewfew1</li>
          <li>fewfewfew1</li>
          <li>fewfewfew1</li>
          <li>fewfewfew1</li>
          <li>fewfewfew1</li>
          <li>fewfewfew1</li>
          <li>fewfewfew1</li>
          <li>fewfewfew1</li>
          <li>fewfewfew1</li>
          <li>fewfewfew1</li>
          <li>fewfewfew1</li>
          <li>fewfewfew1</li>
          <li>fewfewfew1</li>
          <li>fewfewfew1</li>
          <li>fewfewfew1</li>
          <li>fewfewfew1</li>
          <li>fewfewfew1</li>
          <li>fewfewfew1</li>
          <li>fewfewfew1</li>
          <li>fewfewfew1</li>
          {chatHistory.map((m) => (
            <li key={m.id}>
              <b>{m.player}</b> - {m.msg}
            </li>
          ))}
        </ul>
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

};
