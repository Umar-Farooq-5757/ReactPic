import React from "react";
import { useState, useRef, useEffect } from "react";
import { PhotoIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";

const ImageContainer = () => {
  const [imageUrl, setImageUrl] = useState(null);
  const canvasRef = useRef(null);

  const handleImageUpload = (event) => {
    // Get the selected file from the input
    const file = event.target.files[0];
    if (file) {
      // Create a temporary URL for the file to display it
      const newImageUrl = URL.createObjectURL(file);
      setImageUrl(newImageUrl);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) {
      return;
    }

    const ctx = canvas.getContext("2d");
    const image = new Image();
    image.src = imageUrl;

    image.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      ctx.drawImage(image, 0, 0);
    };

    image.onerror = () => {
      console.error("Failed to load image.");
    };
  }, [imageUrl]); // This effect re-runs whenever imageUrl changes.

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) {
      // Do nothing if there's no canvas or image to download
      return;
    }

    // Get the data URL of the canvas content
    // 'image/png' is the default and a good choice for most edits
    const image = canvas.toDataURL("image/png");

    // Create a temporary link element
    const link = document.createElement("a");
    link.href = image;

    // Set the filename for the download
    link.download = "edited-image.png";

    // Append the link to the document body, click it, and then remove it
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="text-black flex flex-col items-center justify-center min-w-[68%] p-4 font-sans antialiased">
      <div className="imageBox rounded-2xl p-6 md:p-8 w-full  text-center">
        <h1 className="text-2xl font-semibold text-left text-gray-800 mb-3">
          Upload Image
        </h1>

        {/* Canvas container. The canvas dimensions are set dynamically in the useEffect. */}
        <div className="border-4 max-w-[755px]  min-h-96 max-h-[580px] border-dashed border-gray-300 rounded-xl overflow-hidden p-4 flex items-center justify-center">
          {imageUrl ? (
            // The canvas element itself
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-[580px] rounded-lg shadow-lg"
            ></canvas>
          ) : (
            <p className="text-gray-400 text-lg">Your image will appear here</p>
          )}
        </div>

        <div className="flex flex-col md:flex-row justify-center items-center gap-4 my-2 mt-8">
          {/* File input for the user to upload an image */}
          <label
            htmlFor="file-upload"
            className=" text-sm bg-[#1e546f] text-white flex cursor-pointer justify-center gap-2 items-center font-semibold py-2 px-4 rounded-md hover:bg-[#29698a] transition-colors duration-200 shadow-md "
          >
              {" "}
              <PhotoIcon className="size-5" />
              Choose an image
          </label>
          <input
            id="file-upload"
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

          {/* Download button, only visible if an image is loaded */}
          {imageUrl && (
            <button
              onClick={handleDownload}
              className="bg-[#34729b] cursor-pointer flex justify-center items-center gap-2 text-sm text-white font-semibold py-2 px-4 rounded-md hover:bg-[#29698a] transition-colors duration-200 shadow-md"
            >
              <ArrowDownTrayIcon className="size-5" />
              Download Image
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageContainer;
