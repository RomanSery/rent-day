// Neighborhood events: city news that changes one block's rent for a few
// rounds. The server starts and ends them (NeighborhoodEventProcessor); this
// file holds what both sides need to agree on: what each kind does, how it
// reads, and which squares it touches.

import { SquareType } from "../enums/SquareType";
import { NeighborhoodEvent, NeighborhoodEventKind } from "../types/NeighborhoodEvent";
import { NyThemeData } from "./NyTheme";
import { SquareConfigDataMap } from "./SquareData";

export interface NeighborhoodEventDef {
  readonly kind: NeighborhoodEventKind;
  /** headline, as on a newspaper */
  readonly title: string;
  /** rent on the affected squares is multiplied by this */
  readonly rentMultiplier: number;
  /** no new houses on the affected squares while it lasts */
  readonly freezesBuilding: boolean;
  /** fine for landing on an affected square you don't own (0 or absent: none) */
  readonly travelFine?: number;
  /** which squares it can hit */
  readonly target: "properties" | "stations";
  /** how long it lasts, in rounds (one turn for each player still in) */
  readonly minRounds: number;
  readonly maxRounds: number;
  /** what happens, for the log and the news panel; `where` names the squares */
  readonly describe: (where: string) => string;
}

export const NEIGHBORHOOD_EVENTS: Record<NeighborhoodEventKind, NeighborhoodEventDef> = {
  [NeighborhoodEventKind.Rezoning]: {
    kind: NeighborhoodEventKind.Rezoning,
    title: "Rezoning",
    rentMultiplier: 1.5,
    freezesBuilding: false,
    target: "properties",
    minRounds: 2,
    maxRounds: 3,
    describe: (where) => `The city rezones ${where}: rent there is up 50%.`,
  },
  [NeighborhoodEventKind.Landmark]: {
    kind: NeighborhoodEventKind.Landmark,
    title: "Landmark status",
    rentMultiplier: 1.25,
    freezesBuilding: true,
    target: "properties",
    minRounds: 2,
    maxRounds: 3,
    describe: (where) => `The city declares ${where} a historic district: rent is up 25%, but no new houses can be built.`,
  },
  [NeighborhoodEventKind.WaterMain]: {
    kind: NeighborhoodEventKind.WaterMain,
    title: "Water main break",
    rentMultiplier: 0.5,
    freezesBuilding: false,
    target: "properties",
    minRounds: 1,
    maxRounds: 2,
    describe: (where) => `A water main breaks under ${where}: rent there is halved.`,
  },
  [NeighborhoodEventKind.SubwayWork]: {
    kind: NeighborhoodEventKind.SubwayWork,
    title: "Subway work",
    rentMultiplier: 0.5,
    freezesBuilding: false,
    target: "stations",
    minRounds: 1,
    maxRounds: 2,
    describe: (where) => `Weekend track work at ${where}: station rent is halved.`,
  },
  [NeighborhoodEventKind.Lockdown]: {
    kind: NeighborhoodEventKind.Lockdown,
    title: "Lockdown",
    rentMultiplier: 0,
    freezesBuilding: true,
    travelFine: 50,
    target: "properties",
    minRounds: 1,
    maxRounds: 2,
    describe: (where) =>
      `${where} is locked down: no rent, no building, and a $50 fine for non-essential travel there.`,
  },
  [NeighborhoodEventKind.DiningBan]: {
    kind: NeighborhoodEventKind.DiningBan,
    title: "Indoor dining ban",
    rentMultiplier: 0.5,
    freezesBuilding: false,
    target: "properties",
    minRounds: 2,
    maxRounds: 2,
    describe: (where) => `Indoor dining is banned in ${where}: rent there is halved.`,
  },
};

/** squares in a group, in board order */
export const squaresInEventGroup = (groupId: number): number[] => {
  const ids: number[] = [];
  SquareConfigDataMap.forEach((d, key) => {
    if (d.groupId === groupId && (d.type === SquareType.Property || d.type === SquareType.TrainStation)) {
      ids.push(key);
    }
  });
  return ids.sort((a, b) => a - b);
};

/** groups an event of this kind can hit */
export const eventGroupsFor = (def: NeighborhoodEventDef): number[] => {
  const wanted = def.target === "stations" ? SquareType.TrainStation : SquareType.Property;
  const groups = new Set<number>();
  SquareConfigDataMap.forEach((d) => {
    if (d.type === wanted && d.groupId) {
      groups.add(d.groupId);
    }
  });
  return Array.from(groups).sort((a, b) => a - b);
};

/** "Coney Island and Sheepshead bay", "Forest Hills, Rego Park and Astoria" */
export const eventGroupName = (groupId: number): string => {
  const names = squaresInEventGroup(groupId).map((id) => NyThemeData.get(id)?.name ?? "");
  if (names.length <= 1) {
    return names[0] ?? "";
  }
  return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
};

export const describeNeighborhoodEvent = (event: NeighborhoodEvent): string =>
  NEIGHBORHOOD_EVENTS[event.kind].describe(eventGroupName(event.groupId));

/** the event (if any) on a square right now */
export const eventOnSquare = (
  events: readonly NeighborhoodEvent[] | undefined | null,
  squareId: number
): NeighborhoodEvent | undefined => {
  const groupId = SquareConfigDataMap.get(squareId)?.groupId;
  if (!events || !groupId) {
    return undefined;
  }
  return events.find((e) => e.groupId === groupId);
};

/** what rent on this square is multiplied by right now (1 when no event) */
export const eventRentMultiplier = (
  events: readonly NeighborhoodEvent[] | undefined | null,
  squareId: number
): number => {
  const event = eventOnSquare(events, squareId);
  return event ? NEIGHBORHOOD_EVENTS[event.kind].rentMultiplier : 1;
};

/** true while an event stops new houses on this square */
export const isBuildingFrozen = (
  events: readonly NeighborhoodEvent[] | undefined | null,
  squareId: number
): boolean => {
  const event = eventOnSquare(events, squareId);
  return !!event && NEIGHBORHOOD_EVENTS[event.kind].freezesBuilding;
};

/** the fine for landing on this square right now (0 when none); the caller lets the owner off */
export const eventTravelFine = (
  events: readonly NeighborhoodEvent[] | undefined | null,
  squareId: number
): number => {
  const event = eventOnSquare(events, squareId);
  return event ? NEIGHBORHOOD_EVENTS[event.kind].travelFine ?? 0 : 0;
};

/** "Rent up 50%", "Rent down 50%", "No rent", with "; no new houses" and the fine, for Help */
export const eventEffectText = (def: NeighborhoodEventDef): string =>
  (def.rentMultiplier === 0
    ? "No rent"
    : (def.rentMultiplier > 1 ? "Rent up " : "Rent down ") + Math.round(Math.abs(def.rentMultiplier - 1) * 100) + "%") +
  (def.target === "stations" ? " on the subway stations" : "") +
  (def.freezesBuilding ? "; no new houses" : "") +
  (def.travelFine ? "; $" + def.travelFine + " fine for landing there (owners excepted)" : "");

/**
 * Rounds left, counting the round in progress: turns left shared out over the
 * players still in.
 */
export const eventRoundsLeft = (event: NeighborhoodEvent, turnNumber: number, playersIn: number): number =>
  Math.max(1, Math.ceil((event.endsAtTurn - turnNumber) / Math.max(1, playersIn)));
