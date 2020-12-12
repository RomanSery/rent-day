import React from "react";

interface Props {
  value: number;
}

export const Die: React.FC<Props> = ({ value }) => {

  const Pip = () => {
    return <span className="pip" />;
  }

  const Face = ({ children }) => {
    return <div className="face">{children}</div>;
  }


  let pips = Number.isInteger(value)
    ? Array(value)
      .fill(0)
      .map((_, i) => <Pip key={i} />)
    : null;
  return <Face>{pips}</Face>;


};
