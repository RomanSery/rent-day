import React from "react";

interface Props {
    id: number;
}

/**
 * The park corner: the faded park photo taped off in an X, with the same tape
 * as a locked-down block. The tape sits inside the photo, which clips it, so
 * it never covers the name or spills out of the square.
 */
export const CentralParkDisplay: React.FC<Props> = ({ id }) => {

    return (
        <React.Fragment>
            <div className="icon">
                <span className="lockdown-tape park-tape park-tape-a" aria-hidden="true"><span>Closed</span></span>
                <span className="lockdown-tape park-tape park-tape-b" aria-hidden="true"><span>Closed</span></span>
            </div>
            <div className="square-name"> park closed</div>
        </React.Fragment>
    );

};
