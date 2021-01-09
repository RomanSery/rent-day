export interface TreasureState {
  readonly _id: string;
  readonly gameId: string;
  readonly playerId: string;
  readonly option1Amount: number;
  readonly option1Percent: number;
  readonly option2Amount: number;
  readonly option2Percent: number;
  readonly option3Amount: number;
  readonly option3Percent: number;
  readonly optionPicked: number;
  readonly randomNum: number;
  readonly prize: number;
}
