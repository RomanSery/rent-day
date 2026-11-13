import { faChevronDown, faChevronUp, faPaperPlane } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Badge, Button, IconButton, InputAdornment, TextField } from "@mui/material";
import React from "react";
import { ChatMsg } from "../../core/types/ChatMsg";
import { GameEvent } from "../../core/types/GameEvent";
import { newChatMsgSound } from "../gameSounds";
import useGameStateStore from "../stores/gameStateStore";
import { getMyPlayerName } from "../helpers";
import { SocketService } from '../sockets/SocketService';
import useChatStore from "../stores/chatStore";

interface Props {
  socketService: SocketService;
}

/** lines shown while the strip is collapsed */
const COLLAPSED_LINES = 3;

/**
 * Game log and chat as one slim strip: the last few lines of the open tab,
 * expandable to the full history. New chat messages raise an unread count on
 * the Chat tab instead of switching away from the log.
 */
export const ChatWindow: React.FC<Props> = ({ socketService }) => {

  const sendChatMsg = useChatStore(state => state.sendChatMsg);
  const setSendChatMsg = useChatStore(state => state.setSendChatMsg);
  const showChat = useChatStore(state => state.showChat);
  const setShowChat = useChatStore(state => state.setShowChat);
  const messages = useChatStore(state => state.messages);
  const addNewMsg = useChatStore(state => state.addNewMsg);
  const initMessages = useChatStore(state => state.initMessages);

  const gameState = useGameStateStore(state => state.data);

  const [expanded, setExpanded] = React.useState(false);
  const [unread, setUnread] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (gameState) {
      initMessages(gameState.messages);
    }
  }, [gameState, initMessages]);

  React.useEffect(() => {
    socketService.listenForEvent(GameEvent.NEW_CHAT_MSG, (msg: ChatMsg) => {
      addNewMsg(msg);
      if (!useChatStore.getState().showChat) {
        setUnread((n) => n + 1);
      }
      newChatMsgSound.play();
    });
  }, [socketService, addNewMsg]);

  const log = gameState?.log ?? [];
  const lineCount = showChat ? messages.length : log.length;

  // keep the newest line in view
  React.useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [lineCount, showChat, expanded]);

  const openChat = () => {
    setShowChat(true);
    setUnread(0);
  };

  const sendChatEvent = () => {
    if (gameState && sendChatMsg && getMyPlayerName()) {
      const newMsg: ChatMsg = {
        msg: sendChatMsg,
        player: getMyPlayerName()!
      };
      socketService.socket.emit(GameEvent.SEND_CHAT_MSG, gameState._id, newMsg);
      setSendChatMsg("");
      addNewMsg(newMsg);
    }
  };

  const visible = <T,>(items: T[]): T[] => (expanded ? items : items.slice(-COLLAPSED_LINES));

  return (
    <div className={"log-strip" + (expanded ? " expanded" : "")}>
      <div className="log-strip-head">
        <Button size="small" className={!showChat ? "active" : ""} onClick={() => setShowChat(false)}>Game log</Button>
        <Badge badgeContent={unread} color="error" overlap="rectangular">
          <Button size="small" className={showChat ? "active" : ""} onClick={openChat}>Chat</Button>
        </Badge>
        <IconButton size="small" className="log-strip-toggle" onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "Show fewer lines" : "Show the full history"}>
          <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronUp} />
        </IconButton>
      </div>

      <div className="log-strip-list" ref={listRef}>
        <ul className="chat-messages">
          {showChat
            ? (messages.length === 0
              ? <li className="log-empty">No messages yet. Say hi!</li>
              : visible(messages).map((m, index) => <li key={index}><b>{m.player}</b> {m.msg}</li>))
            : visible(log).map((m, index) => <li key={index} dangerouslySetInnerHTML={{ __html: m.msg }} />)}
        </ul>
      </div>

      {showChat &&
        <TextField size="small" onChange={(e) => setSendChatMsg(e.currentTarget.value)}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') {
              ev.preventDefault();
              sendChatEvent();
            }
          }}
          placeholder="Type a message" fullWidth={true} value={sendChatMsg ?? ""} variant="outlined" slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={sendChatEvent} aria-label="Send">
                    <FontAwesomeIcon icon={faPaperPlane} />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }} />}
    </div>
  );

};
