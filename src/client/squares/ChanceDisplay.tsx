import React from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faComments } from '@fortawesome/free-solid-svg-icons'
import { chanceName } from "../../core/constants";

interface Props {
    id: number;
}

export const ChanceDisplay: React.FC<Props> = ({ id }) => {

    return (
        <React.Fragment>
            <div className="blank"></div>
            <div className="icon">
                <FontAwesomeIcon icon={faComments} size="3x" color="orange" />
            </div>
            <div className="square-name">{chanceName}</div>
        </React.Fragment>
    );

};