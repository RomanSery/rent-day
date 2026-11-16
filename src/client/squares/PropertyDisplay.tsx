import React from "react";
import useGameStateStore from "../stores/gameStateStore";
import { ColorBar } from "./ColorBar";
import { getSquareTxt } from "./squareHelpers";

interface Props {
    id: number;
}

/** A property's colour bar and name (an auction is shown on the square itself: GameSquare). */
export const PropertyDisplay: React.FC<Props> = ({ id }) => {

    const gameState = useGameStateStore(state => state.data);

    return (
        <React.Fragment>
            <ColorBar id={id} />
            <div className="square-name">
                <div className="square-title">
                    {getSquareTxt(gameState, id)}
                </div>
            </div>
        </React.Fragment>
    );

};
