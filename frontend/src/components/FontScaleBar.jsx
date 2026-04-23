import React, { useState } from 'react';
import { FONT_SCALES, getSavedScale, applyScale } from '../lib/fontScale';

/**
 * FontScaleBar — drop into any nav bar.
 * Shows  A / A+ / A++ / A+++  buttons; active one highlighted.
 */
export default function FontScaleBar() {
  const [active, setActive] = useState(getSavedScale);

  const handleClick = (key) => {
    applyScale(key);
    setActive(key);
  };

  return (
    <div className="flex items-center gap-0.5 bg-white/10 rounded-lg px-1 py-0.5" title="Adjust text size">
      {FONT_SCALES.map(({ key, label }, i) => (
        <button
          key={key}
          onClick={() => handleClick(key)}
          className={`px-2 py-1 rounded-md font-semibold transition-all select-none ${
            active === key
              ? 'bg-aws-orange text-white shadow-sm'
              : 'text-gray-300 hover:text-white hover:bg-white/10'
          }`}
          style={{ fontSize: `${11 + i * 2}px` }}   /* visually grow each button label */
          title={`Text size: ${label}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
