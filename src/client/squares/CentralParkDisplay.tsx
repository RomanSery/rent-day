import React from "react";

interface Props {
    id: number;
}

/** the park corner: taped off in an X, with the same tape as a locked-down block */
export const CentralParkDisplay: React.FC<Props> = ({ id }) => {

    return (
        <React.Fragment>
            <div className="icon"></div>
            <span className="lockdown-tape park-tape park-tape-a" aria-hidden="true"><span>Closed</span></span>
            <span className="lockdown-tape park-tape park-tape-b" aria-hidden="true"><span>Closed</span></span>
            <div className="square-name"> park closed</div>
        </React.Fragment>
    );

};
