import create, { GetState, SetState } from "zustand";
import { ActionMode } from "../../core/enums/ActionMode";
import { ChanceEvent } from "../../core/types/ChanceEvent";
import { GameState } from "../../core/types/GameState";
import { ServerMsg } from "../../core/types/ServerMsg";
import { TradeOffer } from "../../core/types/TradeOffer";

interface GameStateStore {
  data: GameState | undefined;
  actionMode: ActionMode;
  squareToView: number | undefined;
  playerIdToMove: string;
  frames: Array<number>;

  snackOpen: boolean;
  snackMsg: string;
  chanceOpen: boolean;
  chanceEvent: ChanceEvent | undefined;
  serverMsgModalOpen: boolean;
  serverMsg: ServerMsg | undefined;

  updateData: (newData: GameState) => void;
  setSquareToView: (square: number) => void;
  setPlayerIdToMove: (playerId: string) => void;
  clearMovement: () => void;
  showMovementAnimation: (playerId: string, frames: Array<number>) => void;
  setActionMode: (mode: ActionMode) => void;

  setSnackOpen: (newData: boolean) => void;
  setSnackMsg: (newData: string) => void;
  setChanceOpen: (newData: boolean) => void;
  setChanceEvent: (newData: ChanceEvent | undefined) => void;
  setServerMsgModalOpen: (newData: boolean) => void;
  setServerMsg: (newData: ServerMsg | undefined) => void;

  playerToView: string | undefined;
  forceDie1: number | undefined;
  forceDie2: number | undefined;
  offerTradeOpen: boolean;
  reviewTradeOpen: boolean;
  tradeReviewedOpen: boolean;
  travelOpen: boolean;
  tradingWithPlayerId: string | null;
  tradeOffer: TradeOffer | null;

  setPlayerToView: (newData: string | undefined) => void;
  setForceDie1: (newData: number | undefined) => void;
  setForceDie2: (newData: number | undefined) => void;
  setOfferTradeOpen: (newData: boolean) => void;
  setReviewTradeOpen: (newData: boolean) => void;
  setTradeReviewedOpen: (newData: boolean) => void;
  setTravelOpen: (newData: boolean) => void;
  setTradingWithPlayerId: (newData: string | null) => void;
  setTradeOffer: (newData: TradeOffer | null) => void;
}

const useGameStateStore = create<GameStateStore>(
  (set: SetState<GameStateStore>, get: GetState<GameStateStore>) => ({
    data: undefined,
    actionMode: ActionMode.None,
    squareToView: undefined,
    playerIdToMove: "",
    frames: [],
    snackOpen: false,
    snackMsg: "",
    chanceOpen: false,
    chanceEvent: undefined,
    serverMsgModalOpen: false,
    serverMsg: undefined,

    playerToView: undefined,
    forceDie1: undefined,
    forceDie2: undefined,
    offerTradeOpen: false,
    reviewTradeOpen: false,
    tradeReviewedOpen: false,
    travelOpen: false,
    tradingWithPlayerId: null,
    tradeOffer: null,

    setPlayerToView: (newData: string | undefined): void => {
      set({ playerToView: newData });
    },
    setForceDie1: (newData: number | undefined): void => {
      set({ forceDie1: newData });
    },
    setForceDie2: (newData: number | undefined): void => {
      set({ forceDie2: newData });
    },

    setOfferTradeOpen: (newData: boolean): void => {
      set({ offerTradeOpen: newData });
    },
    setReviewTradeOpen: (newData: boolean): void => {
      set({ reviewTradeOpen: newData });
    },
    setTradeReviewedOpen: (newData: boolean): void => {
      set({ tradeReviewedOpen: newData });
    },
    setTravelOpen: (newData: boolean): void => {
      set({ travelOpen: newData });
    },
    setTradingWithPlayerId: (newData: string | null): void => {
      set({ tradingWithPlayerId: newData });
    },
    setTradeOffer: (newData: TradeOffer | null): void => {
      set({ tradeOffer: newData });
    },

    setSnackOpen: (newData: boolean): void => {
      set({ snackOpen: newData });
    },
    setSnackMsg: (newData: string): void => {
      set({ snackMsg: newData });
    },
    setChanceOpen: (newData: boolean): void => {
      set({ chanceOpen: newData });
    },
    setChanceEvent: (newData: ChanceEvent | undefined): void => {
      set({ chanceEvent: newData });
    },
    setServerMsgModalOpen: (newData: boolean): void => {
      set({ serverMsgModalOpen: newData });
    },
    setServerMsg: (newData: ServerMsg | undefined): void => {
      set({ serverMsg: newData });
    },

    updateData: (newData: GameState): void => {
      set({ data: newData });
    },
    setSquareToView: (square: number): void => {
      set({ squareToView: square });
    },
    setPlayerIdToMove: (playerId: string): void => {
      set({ playerIdToMove: playerId });
    },

    clearMovement: (): void => {
      set({ playerIdToMove: "", frames: [] });
    },

    showMovementAnimation: (playerId: string, frames: Array<number>) => {
      set({ playerIdToMove: playerId, frames: frames });
    },
    setActionMode: (mode: ActionMode): void => {
      set({ actionMode: mode });
    },
  })
);

export default useGameStateStore;
