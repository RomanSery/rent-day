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

    const txt: string | undefined = gameInfo?.theme[id].name;
    const icon: string | undefined = gameInfo?.theme[id].icon;

    const getSubwayCompany = () => {
        return (<React.Fragment>
            <div className="blank"></div>
            <div className="icon">
                <FontAwesomeIcon icon={faSubway} size="3x" color="blue" />
            </div>
            <div className="square-name"> {txt}</div>
        </React.Fragment>);
    };

    const getElectricCompany = () => {
        return (<React.Fragment>
            <div className="blank"></div>
            <div className="icon">
                <FontAwesomeIcon icon={faLightbulb} size="3x" color="blue" />
            </div>
            <div className="square-name"> {txt}</div>
        </React.Fragment>);
    };


    return (
        icon === "subway" ? getSubwayCompany() : getElectricCompany()
    );

};