import React from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDollarSign } from '@fortawesome/free-solid-svg-icons'

interface Props {
    id: number;
}

export const TreasureDisplay: React.FC<Props> = ({ id }) => {

    return (
        <React.Fragment>
            <div className="blank"></div>
            <div className="icon">
                <FontAwesomeIcon icon={faDollarSign} size="3x" color="green" />
            </div>
            <div className="square-name"> TREASURE</div>
        </React.Fragment>
    );

};