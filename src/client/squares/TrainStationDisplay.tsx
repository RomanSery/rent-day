import React from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSubway } from '@fortawesome/free-solid-svg-icons'
import { GameState } from "../../core/types/GameState";
import { getSquareStyle, getSquareTxt } from "./squareHelpers";

interface Props {
    id: number;
    gameInfo: GameState | undefined;
}

export const TrainStationDisplay: React.FC<Props> = ({ id, gameInfo }) => {

    return (
        <React.Fragment>
            <div className="blank"></div>
            <div className="icon">
                <FontAwesomeIcon icon={faSubway} size="3x" />
            </div>

            <div className="square-name" style={getSquareStyle(gameInfo, id)}>
                {getSquareTxt(gameInfo, id)}
            </div>

        </React.Fragment>
    );

};