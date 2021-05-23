import create, { GetState, SetState } from "zustand";
import { ActionMode } from "../core/enums/ActionMode";
import { GameState } from "../core/types/GameState";

interface GameStateStore {
  data: GameState | undefined;
  actionMode: ActionMode;
  squareToView: number | undefined;
  playerIdToMove: string;
  frames: Array<number>;

  updateData: (newData: GameState) => void;
  setSquareToView: (square: number) => void;
  setPlayerIdToMove: (playerId: string) => void;
  clearMovement: () => void;
  showMovementAnimation: (playerId: string, frames: Array<number>) => void;
  setActionMode: (mode: ActionMode) => void;
}

const useGameStateStore = create<GameStateStore>(
  (set: SetState<GameStateStore>, get: GetState<GameStateStore>) => ({
    data: undefined,
    actionMode: ActionMode.None,
    squareToView: undefined,
    playerIdToMove: "",
    frames: [],
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
