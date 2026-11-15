export enum NeighborhoodEventKind {
  /** the city rezones a block: rent up */
  Rezoning = "rezoning",
  /** landmark status: rent up a little, but nothing new can be built */
  Landmark = "landmark",
  /** a water main breaks: rent halved */
  WaterMain = "waterMain",
  /** weekend subway work: train station rent halved */
  SubwayWork = "subwayWork",
}

/**
 * A city event that changes one block's rent for a few rounds. Stored on the
 * game while it lasts and shown to every player.
 */
export interface NeighborhoodEvent {
  /** increasing per game, so clients can tell a new event from an old one */
  id: number;
  kind: NeighborhoodEventKind;
  /** the colour group (or the train stations' group) it applies to */
  groupId: number;
  /** turnNumber when it started */
  startTurn: number;
  /** it ends once turnNumber reaches this */
  endsAtTurn: number;
}
