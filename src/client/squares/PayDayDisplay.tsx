import React from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHandHoldingUsd } from '@fortawesome/free-solid-svg-icons'

interface Props {
    id: number;
}

export const PayDayDisplay: React.FC<Props> = ({ id }) => {

    return (
        <React.Fragment>
            <div className="blank"></div>
            <div className="icon">
                <FontAwesomeIcon icon={faHandHoldingUsd} color="green" />
            </div>
            <div className="square-name">Payday</div>
        </React.Fragment>
    );

};