import React from "react";
import { useState } from "react";

const Slider = ({ title, filters, setFilters, value, name, min, max }) => {
  const handleChange = (e) => {
    setFilters({ ...filters, [e.target.name]: parseFloat(e.target.value) });
  };
  return (
     <div className="flex flex-col mb-5">
      <h3 className="font-bold text-sm self-center">{title}</h3>
      <div className="flex justify-center items-center gap-2">
        <span className="border-dashed border-black border px-1 py-0">{min}</span>
        <input
          type="range"
          min={min}
          max={max}
          name={name}
          value={value}
          onChange={handleChange}
          className="range range-xs range-accent "
        />
        <span className="border-dashed border-black border px-1 py-0">{max}</span>
      </div>
    </div>
  );
};
export default Slider
