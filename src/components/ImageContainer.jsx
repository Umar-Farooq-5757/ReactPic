import React, { useState, useRef, useEffect } from "react";
import { PhotoIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline"; // Assume you have a CropIcon
import { saveAs } from "file-saver";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";


const ImageContainer = ({ filters }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const canvasRef = useRef(null);
  const [imageObject, setImageObject] = useState(null);
  const imgRef = useRef(null);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const newImageUrl = URL.createObjectURL(file);
      setImageUrl(newImageUrl);

      const image = new Image();
      image.src = newImageUrl;
      image.onload = () => {
        setImageObject(image);
      };
      image.onerror = () => {
        console.error("Failed to load image.");
      };
    }
  };

  // Create the CSS filter string
  const filterStyle = `
    blur(${filters.blur}px)
    grayscale(${filters.grayScale}%)
    brightness(${filters.brightness}%)
    contrast(${filters.contrast}%)
    hue-rotate(${filters.hueRotate}deg)
    invert(${filters.invert}%)
    opacity(${filters.opacity}%)
    saturate(${filters.saturate}%)
    sepia(${filters.sepia}%)
  `;

  // This effect updates the canvas whenever the image or filters change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObject) {
      return;
    }

    const ctx = canvas.getContext("2d");

    // Set canvas dimensions to match the current image object
    canvas.width = imageObject.naturalWidth;
    canvas.height = imageObject.naturalHeight;

    // Apply the filters to the canvas context before drawing
    ctx.filter = filterStyle;

    // Clear the canvas and redraw the image with the new filter
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageObject, 0, 0);
  }, [imageObject, filters, filterStyle]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) {
      return;
    }

    canvas.toBlob((blob) => {
      if (blob) {
        saveAs(blob, "edited-image.png");
      }
    }, "image/png");
  };

  const handleCrop = () => {
    const image = imgRef.current;
    const canvas = canvasRef.current;
    const crop = completedCrop;
  
    if (!crop || !image || !canvas) {
      return;
    }
  
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const ctx = canvas.getContext('2d');
    const pixelRatio = window.devicePixelRatio;
  
    // Set the canvas dimensions to the cropped area's pixel size
    canvas.width = Math.floor(crop.width * scaleX * pixelRatio);
    canvas.height = Math.floor(crop.height * scaleY * pixelRatio);
  
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';
  
    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width * scaleX,
      crop.height * scaleY
    );
  
    // Get the cropped image as a data URL
    const croppedImageUrl = canvas.toDataURL('image/png');
  
    // Create a new Image object from the cropped data URL
    const croppedImage = new Image();
    croppedImage.src = croppedImageUrl;
  
    // Once the cropped image is loaded, update both states
    croppedImage.onload = () => {
      setImageObject(croppedImage);
      setImageUrl(croppedImageUrl);
      setCrop(undefined);
      setCompletedCrop(undefined);
    };
  };

  return (
    <div className="text-black flex flex-col items-center justify-center w-full lg:w-2/3 p-4 font-sans antialiased">
      <div className="imageBox bg-white rounded-2xl p-6 md:p-5 w-full text-center shadow-lg">
        <h1 className="text-2xl font-semibold text-left text-[#1f5172] mb-3">
          Upload Image
        </h1>
        <div className="border-4 max-w-[800px] min-h-96 max-h-[580px] border-dashed border-gray-300 rounded-xl overflow-hidden p-4 flex items-center justify-center mx-auto">
          {imageUrl ? (
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              // Apply the filters directly to the visible image
              className="w-full h-full"
            >
              <img
                src={imageUrl}
                ref={imgRef}
                alt="Image to crop"
                style={{
                  maxHeight: "580px",
                  maxWidth: "100%",
                  filter: filterStyle, // This is the crucial fix
                }}
              />
            </ReactCrop>
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
          {imageUrl && completedCrop && (
            <button
              onClick={handleCrop}
              className="bg-blue-500 text-white flex cursor-pointer justify-center items-center gap-2 text-sm font-semibold py-2 px-4 rounded-md hover:bg-blue-600 transition-colors duration-200 shadow-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 1.765l-3.321 3.321-2.946-2.946L2.43 4.887 7.234 9.691 1.765 15.16L3.43 16.825l5.469-5.469 4.804 4.804 2.121-2.121-2.42-2.42 2.946-2.946 3.321 3.321V1.765H11z"/></svg>
              Apply Crop
            </button>
          )}
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
      {/* The canvas remains hidden for processing the final image before download */}
      <canvas ref={canvasRef} className="hidden"></canvas>
    </div>
  );
};
export default ImageContainer