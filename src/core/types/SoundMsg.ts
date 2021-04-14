import { SoundType } from "../enums/SoundType";

export interface SoundMsg {
  playerId: string;
  type: SoundType;
}
