import React from "react";
import Slider from "./Slider";

const Sidebar = ({ filters, setFilters }) => {
  return (
    <aside className="size-96 min-h-fit py-7 px-5 bg-white text-black mt-4">
      <h2 className="font-semibold text-2xl mb-3 text-[#1f5172]">Tools</h2>
      <Slider
        title={"Gray Scale"}
        filters={filters}
        setFilters={setFilters}
        value={filters.grayScale}
        name={"grayScale"}
      />
      <Slider
        title={"Brightness"}
        filters={filters}
        setFilters={setFilters}
        value={filters.brightness}
        name={"brightness"}
      />
      <Slider
        title={"Contrast"}
        filters={filters}
        setFilters={setFilters}
        value={filters.contrast}
        name={"contrast"}
      />
      <Slider
        title={"Invert"}
        filters={filters}
        setFilters={setFilters}
        value={filters.invert}
        name={"invert"}
      />
      <Slider
        title={"Opacity"}
        filters={filters}
        setFilters={setFilters}
        value={filters.opacity}
        name={"opacity"}
      />
      <Slider
        title={"Saturate"}
        filters={filters}
        setFilters={setFilters}
        value={filters.saturate}
        name={"saturate"}
      />
      <Slider
        title={"Sepia"}
        filters={filters}
        setFilters={setFilters}
        value={filters.sepia}
        name={"sepia"}
      />
    </aside>
  );
};

export default Sidebar;
