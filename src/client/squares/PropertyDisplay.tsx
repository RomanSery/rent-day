import _ from "lodash";
import React from "react";
import { GameState } from "../../core/types/GameState";
import { ColorBar } from "./ColorBar";

interface Props {
    id: number;
    gameInfo: GameState | undefined;
}

export const PropertyDisplay: React.FC<Props> = ({ id, gameInfo }) => {

    const txt: string | undefined = gameInfo?.theme[id].name;


    return (
        <React.Fragment>
            <ColorBar id={id} />
            <div className="square-name">{txt}</div>
        </React.Fragment>
    );

};