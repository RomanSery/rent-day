import React from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLightbulb } from '@fortawesome/free-solid-svg-icons'
import { faSubway } from '@fortawesome/free-solid-svg-icons'
import { GameState } from "../../core/types/GameState";

interface Props {
    id: number;
    gameInfo: GameState | undefined;
}

export const UtilityDisplay: React.FC<Props> = ({ id, gameInfo }) => {

    const getIcon = () => {
        if (gameInfo && gameInfo.theme && gameInfo.theme.length > 0) {
            return gameInfo.theme[id].icon;
        }
        return "";
    }

    const getTxt = () => {
        if (gameInfo && gameInfo.theme && gameInfo.theme.length > 0) {
            return gameInfo.theme[id].name;
        }
        return "";
    }

    const getSubwayCompany = () => {
        return (<React.Fragment>
            <div className="blank"></div>
            <div className="icon">
                <FontAwesomeIcon icon={faSubway} size="3x" color="blue" />
            </div>
            <div className="square-name"> {getTxt()}</div>
        </React.Fragment>);
    };

    const getElectricCompany = () => {
        return (<React.Fragment>
            <div className="blank"></div>
            <div className="icon">
                <FontAwesomeIcon icon={faLightbulb} size="3x" color="blue" />
            </div>
            <div className="square-name"> {getTxt()}</div>
        </React.Fragment>);
    };


    return (
        getIcon() === "subway" ? getSubwayCompany() : getElectricCompany()
    );

};