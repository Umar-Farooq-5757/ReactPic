import React, { useState, useRef, useEffect } from "react";
import "./App.css";
import Header from "./components/Header";
import ImageContainer from "./components/ImageContainer";
import Sidebar from "./components/Sidebar";

function App() {
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
    <>
      <Header />
      <main className="flex flex-col lg:flex-row justify-between items-start mt-3 px-3">
        <ImageContainer filters={filters} />
        <Sidebar filters={filters} setFilters={setFilters} />
      </main>
    </>
  );
}

export default App;
