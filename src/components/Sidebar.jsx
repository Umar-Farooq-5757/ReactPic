import Slider from "./Slider.jsx";
import '../App.css'

const Sidebar = ({ filters, setFilters, isDark }) => {
  const handleReset = () => {
    setFilters({
      blur: 0,
      grayScale: 0,
      brightness: 100,
      contrast: 100,
      hueRotate: 0,
      invert: 0,
      opacity: 100,
      saturate: 100,
      sepia: 0,
    });
  };

  return (
    <aside className={`w-full overflow-y-auto lg:w-1/3 h-[90vh] py-7 px-5  ${isDark?'bg-slate-700 text-white':'bg-white text-black'} mt-4 lg:mt-0 rounded-lg shadow-lg`}>
      <h2 className={`font-semibold text-2xl mb-3  ${isDark?'text-[#6ac3ff]':'text-[#1f5172]'}`}>Tools</h2>
      <div className="space-y-4">
        <Slider
          title={"Gray Scale"}
          filters={filters}
          setFilters={setFilters}
          value={filters.grayScale}
          name={"grayScale"}
          min={0}
          max={100}
          isDark={isDark}
        />
        <Slider
          title={"Brightness"}
          filters={filters}
          setFilters={setFilters}
          value={filters.brightness}
          name={"brightness"}
          min={0}
          max={200}
          isDark={isDark}
        />
        <Slider
          title={"Contrast"}
          filters={filters}
          setFilters={setFilters}
          value={filters.contrast}
          name={"contrast"}
          min={0}
          max={200}
          isDark={isDark}
        />
        <Slider
          title={"Hue Rotate"}
          filters={filters}
          setFilters={setFilters}
          value={filters.hueRotate}
          name={"hueRotate"}
          min={0}
          max={360}
          isDark={isDark}
        />
        <Slider
          title={"Invert"}
          filters={filters}
          setFilters={setFilters}
          value={filters.invert}
          name={"invert"}
          min={0}
          max={100}
          isDark={isDark}
        />
        <Slider
          title={"Opacity"}
          filters={filters}
          setFilters={setFilters}
          value={filters.opacity}
          name={"opacity"}
          min={0}
          max={100}
          isDark={isDark}
        />
        <Slider
          title={"Saturate"}
          filters={filters}
          setFilters={setFilters}
          value={filters.saturate}
          name={"saturate"}
          min={0}
          max={200}
          isDark={isDark}
        />
        <Slider
          title={"Sepia"}
          filters={filters}
          setFilters={setFilters}
          value={filters.sepia}
          name={"sepia"}
          min={0}
          max={100}
          isDark={isDark}
        />
        <Slider
          title={"Blur"}
          filters={filters}
          setFilters={setFilters}
          value={filters.blur}
          name={"blur"}
          min={0}
          max={10}
          isDark={isDark}
        />
      
      </div>
      <button
        onClick={handleReset}
        className="mt-3 w-full bg-red-500 text-white font-semibold py-1 px-1 rounded-md hover:bg-red-600 transition-colors duration-200 shadow-md"
      >
        Reset Filters
      </button>
    </aside>
  );
};
export default Sidebar;
