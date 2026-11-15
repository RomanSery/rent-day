import React from "react";

/** The Baron, Block Barons' mascot (public/baron.svg). Decorative unless given a label. */
export const Baron: React.FC<{ size?: number; label?: string; className?: string }> = ({ size = 96, label, className }) => (
  <img
    src="/baron.svg"
    width={size}
    height={Math.round(size * 0.97)}
    alt={label ?? ""}
    aria-hidden={label ? undefined : true}
    className={"baron" + (className ? " " + className : "")}
  />
);

/** The Baron beside the Block Barons wordmark. */
export const BrandLogo: React.FC = () => (
  <div className="brand-logo">
    <Baron size={104} />
    <span className="brand-wordmark">
      <span className="brand-block">Block</span>{" "}
      <span className="brand-barons">Barons</span>
    </span>
  </div>
);
