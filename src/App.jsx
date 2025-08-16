import React, { useState, useRef, useEffect } from "react";
import "./App.css";
import Header from "./components/Header";
import ImageContainer from "./components/ImageContainer";
import Sidebar from "./components/Sidebar";
import Footer from "./components/Footer";

function App() {
  const [isDark, setIsDark] = useState(
    JSON.parse(localStorage.getItem("isDark")) || false
  );

  const [filters, setFilters] = useState({
    blur: 0,
    grayScale: 0,
    brightness: 100,
    contrast: 100,
    hueRotate: 3, // deg
    invert: 0,
    opacity: 100,
    saturate: 100,
    sepia: 0,
  });
  return (
    <div
      className={`${
        isDark ? "bg-slate-800 text-white" : "bg-white text-black"
      } min-h-screen transition-all`}
    >
      <Header isDark={isDark} setIsDark={setIsDark} />
      <main className="flex flex-col lg:flex-row justify-between items-start mt-3 px-0 sm:px-3">
        <div className="message text-red-500 text-sm sm:hidden block font-semibold fixed left-1 top-[58px]">
          *UX is better on larger screensize*
        </div>
        <ImageContainer isDark={isDark} filters={filters} />
        <Sidebar isDark={isDark} filters={filters} setFilters={setFilters} />
      </main>
      <Footer isDark={isDark}/>
    </div>
  );
}

export default App;
