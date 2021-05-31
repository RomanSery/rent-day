import create, { GetState, SetState } from "zustand";
import { AuctionState } from "../../core/types/AuctionState";

interface AuctionStore {
  auctionState: AuctionState | undefined;
  myBid: number | undefined;
  mySubmittedBid: number | undefined;

  setAuctionState: (newData: AuctionState | undefined) => void;
  setMyBid: (newData: number | undefined) => void;
  setMySubmittedBid: (newData: number | undefined) => void;
}

const useAuctionStore = create<AuctionStore>(
  (set: SetState<AuctionStore>, get: GetState<AuctionStore>) => ({
    auctionState: undefined,
    myBid: undefined,
    mySubmittedBid: undefined,

    setAuctionState: (newData: AuctionState | undefined): void => {
      set({ auctionState: newData });
    },
    setMyBid: (newData: number | undefined): void => {
      set({ myBid: newData });
    },
    setMySubmittedBid: (newData: number | undefined): void => {
      set({ mySubmittedBid: newData });
    },
  })
);

export default useAuctionStore;
