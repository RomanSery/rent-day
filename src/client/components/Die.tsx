import React from "react";

interface Props {
  value: number;
}

export const Die: React.FC<Props> = ({ value }) => {

  const Pip = () => {
    return <span className="pip" />;
  }


  let pips = Number.isInteger(value)
    ? Array(value)
      .fill(0)
      .map((_, i) => <Pip key={i} />)
    : null;
  return <div className="die-face">{pips}</div>;


};
