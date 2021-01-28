import { TradeStatus } from "../enums/TradeStatus";
import { TradeParticipant } from "./TradeParticipant";

export interface TradeOffer {
  readonly _id: string;
  readonly gameId: string;
  readonly participant1: TradeParticipant;
  readonly participant2: TradeParticipant;
  readonly status: TradeStatus;
}
