export interface ChanceChoiceOption {
  key: string;
  label: string;
}

export interface ChanceEvent {
  isGood: boolean;
  headline: string;
  subLine: string;
  chanceId: number;
  /** set on cards where the player who drew it picks what happens */
  choices?: ChanceChoiceOption[];
}

/** A drawn Chance card still waiting for its player to pick one of its choices. */
export interface PendingChanceChoice extends ChanceEvent {
  playerId: string;
  choices: ChanceChoiceOption[];
}
