import React from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSubway } from '@fortawesome/free-solid-svg-icons'
import { getSquareStyle, getSquareTxt } from "./squareHelpers";
import useGameStateStore from "../gameStateStore";

interface Props {
    id: number;
}

export const TrainStationDisplay: React.FC<Props> = ({ id }) => {

    const gameState = useGameStateStore(state => state.data);

    return (
        <React.Fragment>
            <div className="blank"></div>
            <div className="icon">
                <FontAwesomeIcon icon={faSubway} size="3x" />
            </div>

            <div className="square-name" style={getSquareStyle(gameState, id)}>
                {getSquareTxt(gameState, id)}
            </div>

        </React.Fragment>
    );

};