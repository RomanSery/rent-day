import React from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSubway } from '@fortawesome/free-solid-svg-icons'
import { GameState } from "../../core/types/GameState";
import { getIconProp } from "../helpers";
import { getOwnerPlayer, getSquareStyle, getSquareTxt } from "./squareHelpers";

interface Props {
    id: number;
    gameInfo: GameState | undefined;
}

export const TrainStationDisplay: React.FC<Props> = ({ id, gameInfo }) => {

    const getOwnerIcon = () => {
        const ownerPlayer = getOwnerPlayer(gameInfo, id);
        if (ownerPlayer) {
            return (<FontAwesomeIcon icon={getIconProp(ownerPlayer.type)} color={ownerPlayer.color} />);
        }
        return null;
    }


    return (
        <React.Fragment>
            <div className="blank"></div>
            <div className="icon">
                <FontAwesomeIcon icon={faSubway} size="3x" />
            </div>

            <div className="square-name" style={getSquareStyle(gameInfo, id)}>
                {getSquareTxt(gameInfo, id)} {getOwnerIcon()}
            </div>

        </React.Fragment>
    );

};