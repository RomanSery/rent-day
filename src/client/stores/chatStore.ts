import create, { GetState, SetState } from "zustand";

interface ChatStore {
  sendChatMsg: string | undefined;
  showChat: boolean;

  setSendChatMsg: (newData: string | undefined) => void;
  setShowChat: (newData: boolean) => void;
}

const useChatStore = create<ChatStore>(
  (set: SetState<ChatStore>, get: GetState<ChatStore>) => ({
    sendChatMsg: undefined,
    showChat: true,

    setSendChatMsg: (newData: string | undefined): void => {
      set({ sendChatMsg: newData });
    },
    setShowChat: (newData: boolean): void => {
      set({ showChat: newData });
    },
  })
);

export default useChatStore;
