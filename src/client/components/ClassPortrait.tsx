import React from "react";
import { PlayerClass } from "../../core/enums/PlayerClass";

const KNOWN = new Set<string>(Object.values(PlayerClass));

/** The Baron dressed as a player class (public/classes/*.svg), on a round badge.
    Decorative by default, for places that print the class name beside it;
    pass `labelled` where the portrait stands alone. */
export const ClassPortrait: React.FC<{ playerClass?: string; size?: number; labelled?: boolean; className?: string }> =
  ({ playerClass, size = 20, labelled, className }) => {
    if (!playerClass || !KNOWN.has(playerClass)) return null;
    return (
      <img
        src={`/classes/${playerClass.toLowerCase()}.svg`}
        width={size}
        height={size}
        alt={labelled ? playerClass : ""}
        aria-hidden={labelled ? undefined : true}
        title={labelled ? playerClass : undefined}
        className={"class-portrait" + (className ? " " + className : "")}
      />
    );
  };
