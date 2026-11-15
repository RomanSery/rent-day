// Starts and ends neighborhood events (see @core/config/NeighborhoodEvents).
//
// Runs once at the end of every turn. Nothing happens in the first rounds, so
// players have bought some property before values start to move; after that a
// new event starts every few rounds, with at most two running at once and
// never two on the same group. All randomness comes from the game's seeded
// generator, so seeded games replay the same events.

import { PlayerState } from "@core/enums/PlayerState";
import { NeighborhoodEvent, NeighborhoodEventKind } from "@core/types/NeighborhoodEvent";
import {
  NEIGHBORHOOD_EVENTS,
  describeNeighborhoodEvent,
  eventGroupName,
  eventGroupsFor,
} from "@core/config/NeighborhoodEvents";
import { GameInstanceDocument } from "../model";
import { randomInt, randomPick } from "../random";

/** rounds before the first event can start */
export const FIRST_EVENT_AFTER_ROUNDS = 3;
/** rounds between one event starting and the next */
const MIN_GAP_ROUNDS = 2;
const MAX_GAP_ROUNDS = 4;
/** events running at the same time */
export const MAX_ACTIVE_EVENTS = 2;

/** a seeded draw is easier to keep balanced from a weighted list */
const KIND_WEIGHTS: Array<[NeighborhoodEventKind, number]> = [
  [NeighborhoodEventKind.Rezoning, 3],
  [NeighborhoodEventKind.Landmark, 2],
  [NeighborhoodEventKind.WaterMain, 3],
  [NeighborhoodEventKind.SubwayWork, 1],
];

export interface NeighborhoodNews {
  started: NeighborhoodEvent[];
  ended: NeighborhoodEvent[];
}

export class NeighborhoodEventProcessor {
  /** Call after turnNumber has moved on. Returns what changed, for announcing. */
  public static onTurnCompleted(game: GameInstanceDocument): NeighborhoodNews {
    const news: NeighborhoodNews = { started: [], ended: [] };
    const turn = game.turnNumber ?? 0;
    const playersIn = NeighborhoodEventProcessor.playersIn(game);
    if (playersIn < 2) {
      return news;
    }

    const events = game.neighborhoodEvents ?? [];
    news.ended = events.filter((e) => turn >= e.endsAtTurn);
    game.neighborhoodEvents = events.filter((e) => turn < e.endsAtTurn);
    news.ended.forEach((e) => {
      game.log.push({
        msg: "<b>City news</b> - " + NEIGHBORHOOD_EVENTS[e.kind].title + " in " + eventGroupName(e.groupId) + " is over",
        player: "",
      });
    });

    if (game.nextNeighborhoodEventTurn == null) {
      // the first event comes during round FIRST_EVENT_AFTER_ROUNDS + 1; a
      // game from before events existed gets one on its next turn
      game.nextNeighborhoodEventTurn = Math.max(
        turn + 1,
        FIRST_EVENT_AFTER_ROUNDS * playersIn + randomInt(game, 0, playersIn - 1)
      );
    }

    if (turn >= game.nextNeighborhoodEventTurn && game.neighborhoodEvents.length < MAX_ACTIVE_EVENTS) {
      const event = NeighborhoodEventProcessor.startEvent(game, turn, playersIn);
      if (event) {
        news.started.push(event);
      }
      game.nextNeighborhoodEventTurn = turn + NeighborhoodEventProcessor.gapTurns(game, playersIn);
    }

    return news;
  }

  /** Development only: start a given kind of event right now, on a given group if possible. */
  public static forceEvent(
    game: GameInstanceDocument,
    kind: NeighborhoodEventKind,
    groupId?: number
  ): NeighborhoodEvent | null {
    return NeighborhoodEventProcessor.startEvent(
      game,
      game.turnNumber ?? 0,
      Math.max(2, NeighborhoodEventProcessor.playersIn(game)),
      kind,
      groupId
    );
  }

  private static startEvent(
    game: GameInstanceDocument,
    turn: number,
    playersIn: number,
    forcedKind?: NeighborhoodEventKind,
    forcedGroup?: number
  ): NeighborhoodEvent | null {
    const active = game.neighborhoodEvents ?? [];
    const busy = new Set(active.map((e) => e.groupId));

    const kind = forcedKind ?? NeighborhoodEventProcessor.pickKind(game, busy);
    if (!kind) {
      return null;
    }
    const def = NEIGHBORHOOD_EVENTS[kind];
    const free = eventGroupsFor(def).filter((g) => !busy.has(g));
    const groupId = forcedGroup !== undefined && free.includes(forcedGroup) ? forcedGroup : randomPick(game, free);
    if (groupId === undefined) {
      return null;
    }

    const rounds = randomInt(game, def.minRounds, def.maxRounds);
    const event: NeighborhoodEvent = {
      id: (game.neighborhoodEventSeq ?? 0) + 1,
      kind,
      groupId,
      startTurn: turn,
      endsAtTurn: turn + rounds * playersIn,
    };
    game.neighborhoodEventSeq = event.id;
    game.neighborhoodEvents = [...active, event];
    game.log.push({
      msg: "<b>City news</b> - " + def.title + ": " + describeNeighborhoodEvent(event) +
        " (" + rounds + (rounds === 1 ? " round)" : " rounds)"),
      player: "",
    });
    return event;
  }

  /** a weighted kind that still has a free group to land on */
  private static pickKind(game: GameInstanceDocument, busy: Set<number>): NeighborhoodEventKind | null {
    const options = KIND_WEIGHTS.filter(([kind]) =>
      eventGroupsFor(NEIGHBORHOOD_EVENTS[kind]).some((g) => !busy.has(g))
    );
    const total = options.reduce((sum, [, w]) => sum + w, 0);
    if (total <= 0) {
      return null;
    }
    let roll = randomInt(game, 1, total);
    for (const [kind, weight] of options) {
      roll -= weight;
      if (roll <= 0) {
        return kind;
      }
    }
    return options[options.length - 1][0];
  }

  private static gapTurns(game: GameInstanceDocument, playersIn: number): number {
    return randomInt(game, MIN_GAP_ROUNDS, MAX_GAP_ROUNDS) * playersIn;
  }

  private static playersIn(game: GameInstanceDocument): number {
    return game.players.filter((p) => p.state !== PlayerState.BANKRUPT).length;
  }
}
