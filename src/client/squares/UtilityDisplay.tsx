import React from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLightbulb, faTrain } from '@fortawesome/free-solid-svg-icons'
import { getSquareStyle, getSquareTxt } from "./squareHelpers";
import useGameStateStore from "../gameStateStore";

interface Props {
    id: number;
}

export const UtilityDisplay: React.FC<Props> = ({ id }) => {

    const gameState = useGameStateStore(state => state.data);

    const getUtilityIcon = () => {
        if (gameState && gameState.theme) {
            const icon = gameState.theme[id].icon;
            return icon === "subway" ? faTrain : faLightbulb;
        }
        return faTrain;
    };


    return (
        <React.Fragment>
            <div className="blank"></div>
            <div className="icon">
                <FontAwesomeIcon icon={getUtilityIcon()} size="3x" color="blue" />
            </div>
            <div className="square-name" style={getSquareStyle(gameState, id)}>
                {getSquareTxt(gameState, id)}
            </div>
        </React.Fragment>
    );

};