import create, { GetState, SetState } from "zustand";

interface TradeStateStore {
  myChecked: number[];
  theirChecked: number[];
  myAmount: number;
  theirAmount: number;

  setMyChecked: (newData: number[]) => void;
  setTheirChecked: (newData: number[]) => void;
  setMyAmount: (newData: number) => void;
  setTheirAmount: (newData: number) => void;
  clear: () => void;
}

const useTradeStateStore = create<TradeStateStore>(
  (set: SetState<TradeStateStore>, get: GetState<TradeStateStore>) => ({
    myChecked: [],
    theirChecked: [],
    myAmount: 0,
    theirAmount: 0,

    setMyChecked: (newData: number[]): void => {
      set({ myChecked: newData });
    },
    setTheirChecked: (newData: number[]): void => {
      set({ theirChecked: newData });
    },
    setMyAmount: (newData: number): void => {
      set({ myAmount: newData });
    },
    setTheirAmount: (newData: number): void => {
      set({ theirAmount: newData });
    },

    clear: (): void => {
      set({ myChecked: [], theirChecked: [], myAmount: 0, theirAmount: 0 });
    },
  })
);

export default useTradeStateStore;
