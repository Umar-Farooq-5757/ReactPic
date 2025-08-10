import React, { useState, useRef, useEffect } from "react";
import { PhotoIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { saveAs } from "file-saver";

const ImageContainer = ({ filters }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const canvasRef = useRef(null);
  const [imageObject, setImageObject] = useState(null); // State to hold the original image object

  // This function is called when a user selects a new image file
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Create a temporary URL for the file
      const newImageUrl = URL.createObjectURL(file);
      setImageUrl(newImageUrl);

      // Create a new Image object and set its source
      const image = new Image();
      image.src = newImageUrl;
      image.onload = () => {
        setImageObject(image); // Store the loaded image object in state
      };
      image.onerror = () => {
        console.error("Failed to load image.");
      };
    }
  };

  // This effect updates the canvas whenever the image or filters change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObject) {
      return;
    }

    const ctx = canvas.getContext("2d");

    // Set canvas dimensions to match the original image
    canvas.width = imageObject.naturalWidth;
    canvas.height = imageObject.naturalHeight;

    // Apply the filters to the canvas context before drawing
    // This bakes the filter into the pixel data
    const {
      blur,
      grayScale,
      brightness,
      contrast,
      hueRotate,
      invert,
      opacity,
      saturate,
      sepia,
    } = filters;
    ctx.filter = `blur(${blur}px) grayscale(${grayScale}%) brightness(${brightness}%) contrast(${contrast}%) hue-rotate(${hueRotate}deg) invert(${invert}%) opacity(${opacity}%) saturate(${saturate}%) sepia(${sepia}%)`;

    // Clear the canvas and redraw the image with the new filter
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageObject, 0, 0);
  }, [imageObject, filters]); // Re-run this effect when the image or filters change

  // This function now correctly downloads the filtered image from the canvas
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) {
      // Do nothing if there's no canvas or image to download
      return;
    }

    // Get the data URL of the canvas content.
    // The image data now includes the filters applied in the useEffect hook.
    canvas.toBlob((blob) => {
      if (blob) {
        saveAs(blob, "edited-image.png");
      }
    }, "image/png");
  };

  return (
    <div className="text-black flex flex-col items-center justify-center min-w-[68%] p-4 font-sans antialiased">
      <div className="imageBox rounded-2xl p-6 md:p-5 w-full text-center">
        <h1 className="text-2xl font-semibold text-left text-[#1f5172] mb-3">
          Upload Image
        </h1>
        <div className="border-4 max-w-[800px] min-h-96 max-h-[580px] border-dashed border-gray-300 rounded-xl overflow-hidden p-4 flex items-center justify-center">
          {imageUrl ? (
            // The canvas element itself
            <canvas
              ref={canvasRef}
              className={`max-w-full max-h-[580px] rounded-lg shadow-lg`}
            ></canvas>
          ) : (
            <p className="text-gray-400 text-lg">Your image will appear here</p>
          )}
        </div>
        <div className="flex flex-col md:flex-row justify-center items-center gap-4 my-2 mt-8">
          <label
            htmlFor="file-upload"
            className="text-sm bg-[#1e546f] text-white flex cursor-pointer justify-center gap-2 items-center font-semibold py-2 px-4 rounded-md hover:bg-[#29698a] transition-colors duration-200 shadow-md"
          >
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
