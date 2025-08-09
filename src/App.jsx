import { useState } from "react";
import "./App.css";
import Header from "./components/Header";
import ImageContainer from "./components/ImageContainer";
import Sidebar from "./components/Sidebar";

function App() {
  return (
    <>
      <Header />
      <main className="flex justify-between mt-3 px-3">
        <ImageContainer />
        <Sidebar />
      </main>
    </>
  );
}

export default App;
