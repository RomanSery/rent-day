import React from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlane } from '@fortawesome/free-solid-svg-icons'
import { GameState } from "../../core/types/GameState";

interface Props {
    id: number;
    gameInfo: GameState | undefined;
}

export const AirportDisplay: React.FC<Props> = ({ id, gameInfo }) => {

    const getTxt = () => {
        if (gameInfo && gameInfo.theme) {
            return gameInfo.theme[id].name;
        }
        return "";
    }

    return (
        <React.Fragment>
            <div className="blank"></div>
            <div className="icon">
                <FontAwesomeIcon icon={faPlane} size="3x" />
            </div>
            <div className="square-name"> {getTxt()}</div>
        </React.Fragment>
    );

};