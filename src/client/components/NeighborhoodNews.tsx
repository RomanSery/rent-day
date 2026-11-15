import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faArrowTrendDown, faArrowTrendUp, faLandmark, faNewspaper, faTrainSubway } from "@fortawesome/free-solid-svg-icons";
import useGameStateStore from "../stores/gameStateStore";
import { PlayerState } from "../../core/enums/PlayerState";
import { NeighborhoodEvent, NeighborhoodEventKind } from "../../core/types/NeighborhoodEvent";
import {
  NEIGHBORHOOD_EVENTS,
  describeNeighborhoodEvent,
  eventRoundsLeft,
  squaresInEventGroup,
} from "../../core/config/NeighborhoodEvents";

export const NEIGHBORHOOD_EVENT_ICONS: Record<NeighborhoodEventKind, IconDefinition> = {
  [NeighborhoodEventKind.Rezoning]: faArrowTrendUp,
  [NeighborhoodEventKind.Landmark]: faLandmark,
  [NeighborhoodEventKind.WaterMain]: faArrowTrendDown,
  [NeighborhoodEventKind.SubwayWork]: faTrainSubway,
};

/** "+50% rent", "-50% rent" */
export const rentChangeText = (event: NeighborhoodEvent): string => {
  const pct = Math.round((NEIGHBORHOOD_EVENTS[event.kind].rentMultiplier - 1) * 100);
  return (pct > 0 ? "+" : "−") + Math.abs(pct) + "% rent";
};

export const isRentUp = (event: NeighborhoodEvent): boolean =>
  NEIGHBORHOOD_EVENTS[event.kind].rentMultiplier > 1;

/**
 * City news: the neighborhood events changing rent right now, with how long
 * each has left. Picking one shows its first square in the info card.
 */
export const NeighborhoodNews: React.FC = () => {
  const gameState = useGameStateStore((state) => state.data);
  const setSquareToView = useGameStateStore((state) => state.setSquareToView);

  const events = gameState?.neighborhoodEvents ?? [];
  if (!gameState || events.length === 0) {
    return null;
  }

  const turn = gameState.turnNumber ?? 0;
  const playersIn = Math.max(1, gameState.players.filter((p) => p.state !== PlayerState.BANKRUPT).length);

  return (
    <section className="turn-stage city-news" aria-label="City news">
      <div className="city-news-head">
        <FontAwesomeIcon icon={faNewspaper} /> City news
      </div>
      <ul className="city-news-list">
        {events.map((event) => {
          const def = NEIGHBORHOOD_EVENTS[event.kind];
          const rounds = eventRoundsLeft(event, turn, playersIn);
          const isNew = turn - event.startTurn < playersIn;
          const first = squaresInEventGroup(event.groupId)[0];
          return (
            <li key={event.id}>
              <button type="button" className={"city-news-item " + (isRentUp(event) ? "up" : "down")}
                onClick={() => first && setSquareToView(first)}>
                <span className="city-news-icon"><FontAwesomeIcon icon={NEIGHBORHOOD_EVENT_ICONS[event.kind]} /></span>
                <span className="city-news-text">
                  <span className="city-news-title">
                    {def.title}
                    {isNew && <span className="city-news-new">New</span>}
                  </span>
                  <span className="city-news-desc">{describeNeighborhoodEvent(event)}</span>
                </span>
                <span className="city-news-meta">
                  <span className="city-news-change">{rentChangeText(event)}</span>
                  <span className="city-news-left">{rounds === 1 ? "last round" : rounds + " rounds left"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
