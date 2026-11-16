import React from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSyringe } from '@fortawesome/free-solid-svg-icons'

interface Props {
    id: number;
}

export const LottoDisplay: React.FC<Props> = ({ id }) => {

    return (
        <React.Fragment>
            <div className="blank"></div>
            <div className="icon">
                <FontAwesomeIcon icon={faSyringe} size="3x" color="green" />
            </div>
            <div className="square-name"> VAX LOTTERY</div>
        </React.Fragment>
    );

};