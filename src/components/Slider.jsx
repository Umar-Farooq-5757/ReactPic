import React from "react";
import { useState } from "react";

const Slider = ({ title, filters, setFilters, value, name }) => {
  const handleChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
    console.log(filters)
  };
  return (
    <div className="flex flex-col mb-5">
      <h3 className="font-bold text-sm self-center">{title}</h3>
      <div className="flex justify-center items-center gap-2">
        <span className="border-dashed border-black border px-1 py-0">0</span>
        <input
          type="range"
          min={0}
          max="100"
          name={name}
          value={value}
          onChange={handleChange}
          className="range range-xs range-accent "
        />
        <span className="border-dashed border-black border px-1 py-0">100</span>
      </div>
    </div>
  );
};

export default Slider;
