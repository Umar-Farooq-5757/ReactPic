import React from "react";
import { FaGithub } from "react-icons/fa";
import { FaInstagram } from "react-icons/fa";
import { CgMail } from "react-icons/cg";

const Footer = ({isDark}) => {


  return (
    <footer
      className={`h-12 flex justify-around items-center mt-2 bg-[#6ab7c3] text-white`}
    >
      <p className="text-sm sm:text-lg">
        Made with ❤️ by <span className="font-serif">Umar Farooq</span>
      </p>
      <div className="links flex justify-center items-center gap-4 sm:gap-7">
        <a
          className="hover:bg-[#81cbd6] p-1 rounded-sm"
          href="https://github.com/umar-farooq-5757"
          target="_blank"
        >
          <FaGithub className="w-5 h-5 sm:w-7 sm:h-7" />
        </a>
        <a
          className="hover:bg-[#81cbd6] p-1 rounded-sm"
          href="https://instagram.com/aamirgel17"
          target="_blank"
        >
          <FaInstagram className="w-5 h-5 sm:w-8 sm:h-8" />
        </a>
        <a
          className="hover:bg-[#81cbd6] p-1 rounded-sm"
          href="mailto:aamirgel17@gmail.com"
          target="_blank"
        >
          <CgMail className="w-6 h-6 sm:w-9 sm:h-9" />
        </a>
      </div>
    </footer>
  );
};

export default Footer;