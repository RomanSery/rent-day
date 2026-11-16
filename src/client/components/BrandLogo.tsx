import React from "react";

/** The Baron, Rentdemic's mascot (public/baron.svg). Decorative unless given a label. */
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

/** The Baron beside the Rentdemic wordmark, under its tagline. */
export const BrandLogo: React.FC = () => (
  <div className="brand-logo">
    <Baron size={104} />
    <span className="brand-wordmark" role="img" aria-label="Rentdemic">
      <span className="brand-tagline" aria-hidden="true">Flatten the rent</span>
      <span className="brand-name" aria-hidden="true">
        <span className="brand-rent">Rent</span><span className="brand-demic">demic</span>
      </span>
    </span>
  </div>
);
