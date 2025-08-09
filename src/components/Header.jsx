import React from "react";
import { useState } from "react";
import { SunIcon, MoonIcon } from "@heroicons/react/24/outline";

const Header = () => {
  const [isDark, setIsDark] = useState(true);
  return (
    <header className="bg-[#6ab7c3] text-white flex items-center justify-between px-40 py-2">
      <h1 className="text-3xl font-bold ">ReactPic</h1>
      <button
        onClick={() => setIsDark(!isDark)}
        className="cursor-pointer hover:bg-[#81cbd6] transition-all p-1 rounded-full"
      >
        {isDark ? (
          <SunIcon className="size-6 " />
        ) : (
          <MoonIcon className="size-6 " />
        )}
      </button>
    </header>
  );
};

export default Header;
