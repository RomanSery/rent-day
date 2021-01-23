import React from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBiohazard } from '@fortawesome/free-solid-svg-icons'

interface Props {
    id: number;
}

export const IsolationDisplay: React.FC<Props> = ({ id }) => {

    return (
        <React.Fragment>
            <div className="icon">
                <FontAwesomeIcon icon={faBiohazard} size="4x" color="red" />
            </div>
        </React.Fragment>
    );

};