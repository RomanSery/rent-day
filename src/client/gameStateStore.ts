import create, { GetState, SetState } from "zustand";
import { ActionMode } from "../core/enums/ActionMode";
import { ChanceEvent } from "../core/types/ChanceEvent";
import { GameState } from "../core/types/GameState";
import { ServerMsg } from "../core/types/ServerMsg";

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
