import create, { GetState, SetState } from "zustand";
import { ChatMsg } from "../../core/types/ChatMsg";

interface ChatStore {
  sendChatMsg: string | undefined;
  showChat: boolean;
  messages: Array<ChatMsg>;

  setSendChatMsg: (newData: string | undefined) => void;
  setShowChat: (newData: boolean) => void;
  addNewMsg: (newMsg: ChatMsg) => void;
  initMessages: (msgs: Array<ChatMsg>) => void;
}

const useChatStore = create<ChatStore>(
  (set: SetState<ChatStore>, get: GetState<ChatStore>) => ({
    sendChatMsg: undefined,
    showChat: true,
    messages: [],

    setSendChatMsg: (newData: string | undefined): void => {
      set({ sendChatMsg: newData });
    },
    setShowChat: (newData: boolean): void => {
      set({ showChat: newData });
    },
    initMessages: (msgs: Array<ChatMsg>): void => {
      set({ messages: msgs });
    },
    addNewMsg: (newMsg: ChatMsg): void => {
      const msgs = get().messages;
      set({ messages: [...msgs, newMsg] });

    }
  })
);

export default useChatStore;
