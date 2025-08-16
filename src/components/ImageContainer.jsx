import React, { useState, useRef, useEffect } from "react";
import { PhotoIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { saveAs } from "file-saver";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

// ImageContainer with drawing, crop, filters, download, and rotate functionality.
// Inline comments explain implementation details and important edge-cases.
export default function ImageContainer({ filters, isDark }) {
  // ---------- Refs & state ----------
  const [imageUrl, setImageUrl] = useState(null); // currently-displayed image src (data url or object URL)
  const imgRef = useRef(null); // <img> element reference
  const drawCanvasRef = useRef(null); // visible overlay canvas where user draws
  const exportCanvasRef = useRef(null); // hidden canvas used for crop/export/rotate operations
  const wrapperRef = useRef(null); // wrapper around crop+img; used to position overlay canvas

  const [imageObject, setImageObject] = useState(null); // Image() object for natural dimensions
  const [crop, setCrop] = useState(); // react-image-crop active crop
  const [completedCrop, setCompletedCrop] = useState(null); // last completed crop

  // Drawing states
  const [drawEnabled, setDrawEnabled] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [brushColor, setBrushColor] = useState("#ff0000");
  const [brushSize, setBrushSize] = useState(6);
  // strokesRef stores strokes in *display coordinates* (CSS pixels relative to displayed image)
  // Each stroke: { points: [{x,y}], color, size, eraser }
  const strokesRef = useRef([]);
  const currentStrokeRef = useRef(null);

  // rotationAngle is kept implicit: rotating creates a new image (data URL) so we don't need
  // to maintain complicated transforms. This keeps overlay logic simple.

  // ---------- Filters ----------
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

  // ---------- Image upload ----------
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const newImageUrl = URL.createObjectURL(file);
      setImageUrl(newImageUrl);

      // create Image object to access naturalWidth/naturalHeight later
      const image = new Image();
      image.src = newImageUrl;
      image.onload = () => {
        setImageObject(image);
        // Clear any previous drawings because new image has different coords
        strokesRef.current = [];
        // Small delay to allow the <img> to layout, then align the drawing canvas
        setTimeout(syncDrawCanvasToImage, 50);
      };
      image.onerror = () => {
        console.error("Failed to load image.");
      };
    }
  };

  // ---------- Canvas synchronization ----------
  // Aligns the overlay canvas exactly over the displayed image. Uses getBoundingClientRect()
  // and ResizeObserver to react to layout changes. Also sets the backing-store size using
  // devicePixelRatio so strokes remain crisp on high-DPI screens.
  const syncDrawCanvasToImage = () => {
    const img = imgRef.current;
    const canvas = drawCanvasRef.current;
    const wrapper = wrapperRef.current;
    if (!img || !canvas || !wrapper) return;

    const imgRect = img.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Canvas CSS position relative to wrapper
    const left = imgRect.left - wrapperRect.left;
    const top = imgRect.top - wrapperRect.top;

    // Display size in CSS pixels
    const dispW = Math.max(1, Math.round(imgRect.width));
    const dispH = Math.max(1, Math.round(imgRect.height));

    // Position and size the canvas in CSS pixels so it overlays the image visually
    canvas.style.position = "absolute";
    canvas.style.left = `${left}px`;
    canvas.style.top = `${top}px`;
    canvas.style.width = `${dispW}px`;
    canvas.style.height = `${dispH}px`;
    canvas.style.zIndex = 5; // keep it above the image and below UI controls

    // Then set the internal pixel backing store scaled by devicePixelRatio for sharpness
    canvas.width = Math.floor(dispW * dpr);
    canvas.height = Math.floor(dispH * dpr);

    // Map drawing operations from CSS pixels to backing store using setTransform
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Repaint any stored strokes onto the resized canvas
    redrawStrokes();
  };

  useEffect(() => {
    // Keep in sync on resize and when the image or crop change
    const onResize = () => syncDrawCanvasToImage();
    window.addEventListener("resize", onResize);

    // ResizeObserver ensures we catch layout changes even if they aren't window resizes
    let ro;
    if (imgRef.current) {
      ro = new ResizeObserver(() => syncDrawCanvasToImage());
      ro.observe(imgRef.current);
    }

    // initial sync after mount / image load
    setTimeout(syncDrawCanvasToImage, 100);

    return () => {
      window.removeEventListener("resize", onResize);
      if (ro && imgRef.current) ro.unobserve(imgRef.current);
    };
  }, [imageUrl, completedCrop, drawEnabled]);

  // ---------- Drawing utilities ----------
  // Repaint all strokes (stored in CSS pixels) onto the overlay canvas. Uses
  // destination-out composite for eraser strokes.
  const redrawStrokes = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // clear whole canvas in CSS pixels (ctx transform maps to CSS space)
    const cssW = parseFloat(canvas.style.width) || canvas.width;
    const cssH = parseFloat(canvas.style.height) || canvas.height;
    ctx.clearRect(0, 0, cssW, cssH);

    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    for (const s of strokesRef.current) {
      if (!s.points || s.points.length === 0) continue;
      ctx.lineWidth = s.size;
      if (s.eraser) {
        // Eraser: draw using destination-out so underlying pixels become transparent on export
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++)
          ctx.lineTo(s.points[i].x, s.points[i].y);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.strokeStyle = s.color;
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++)
          ctx.lineTo(s.points[i].x, s.points[i].y);
        ctx.stroke();
      }
    }
  };

  // Get pointer position relative to top-left of the overlay canvas (CSS pixels)
  const getLocalPointerPos = (e) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // Pointer handlers: use pointer capture so drawing continues even if pointer leaves the canvas
  // Strokes are stored in CSS pixels for easier scaling during export
  const handlePointerDown = (e) => {
    if (!drawEnabled) return;
    e.preventDefault();
    const canvas = drawCanvasRef.current;
    if (canvas && e.pointerId != null) canvas.setPointerCapture(e.pointerId);

    currentStrokeRef.current = {
      points: [],
      color: brushColor,
      size: brushSize,
      eraser: isErasing,
    };
    const p = getLocalPointerPos(e);
    currentStrokeRef.current.points.push(p);

    // immediate tiny segment so user sees a dot when they tap/click
    const ctx = canvas.getContext("2d");
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = brushSize;
    if (isErasing) {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 0.1, p.y + 0.1);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.strokeStyle = brushColor;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 0.1, p.y + 0.1);
      ctx.stroke();
    }
  };

  const handlePointerMove = (e) => {
    if (!currentStrokeRef.current) return;
    e.preventDefault();
    const p = getLocalPointerPos(e);
    const s = currentStrokeRef.current;
    s.points.push(p);

    // incremental draw for instant feedback
    const canvas = drawCanvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = s.size;

    if (s.eraser) {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      const pts = s.points;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.strokeStyle = s.color;
      ctx.beginPath();
      const pts = s.points;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
  };

  const handlePointerUp = (e) => {
    if (!currentStrokeRef.current) return;
    const canvas = drawCanvasRef.current;
    if (canvas && e.pointerId != null)
      canvas.releasePointerCapture(e.pointerId);

    // finalize stroke
    strokesRef.current.push(currentStrokeRef.current);
    currentStrokeRef.current = null;
  };

  const handleUndo = () => {
    strokesRef.current.pop();
    redrawStrokes();
  };
  const handleClearDraw = () => {
    strokesRef.current = [];
    redrawStrokes();
  };

  // ---------- Export / Download ----------
  // Composes image (with CSS filters) + scaled strokes at the image's natural resolution
  const handleDownload = () => {
    const img = imgRef.current;
    if (!img || !imageUrl) return;

    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;

    const exportCanvas =
      exportCanvasRef.current || document.createElement("canvas");
    exportCanvas.width = naturalW;
    exportCanvas.height = naturalH;
    const ctx = exportCanvas.getContext("2d");

    // Draw image with filters applied. Note: ctx.filter understands the same CSS filter syntax
    ctx.filter = filterStyle;
    ctx.drawImage(img, 0, 0, naturalW, naturalH);

    // Map strokes from displayed CSS pixels to natural pixels using scale factors
    const dispW = img.clientWidth || naturalW;
    const dispH = img.clientHeight || naturalH;
    const scaleX = naturalW / dispW;
    const scaleY = naturalH / dispH;
    const avgScale = (scaleX + scaleY) / 2; // average to scale stroke width

    for (const s of strokesRef.current) {
      ctx.save();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.lineWidth = s.size * avgScale;
      if (s.eraser) ctx.globalCompositeOperation = "destination-out";
      else ctx.globalCompositeOperation = "source-over";

      if (!s.eraser) ctx.strokeStyle = s.color;

      ctx.beginPath();
      const pts = s.points;
      if (pts.length > 0) {
        ctx.moveTo(pts[0].x * scaleX, pts[0].y * scaleY);
        for (let i = 1; i < pts.length; i++)
          ctx.lineTo(pts[i].x * scaleX, pts[i].y * scaleY);
        ctx.stroke();
      }
      ctx.restore();
    }

    exportCanvas.toBlob((blob) => {
      if (blob) saveAs(blob, "edited-image.png");
    }, "image/png");
  };

  // ---------- Crop handling ----------
  const handleCrop = () => {
    const image = imgRef.current;
    const c = completedCrop;
    if (!c || !image) return;

    const canvas = exportCanvasRef.current || document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const ctx = canvas.getContext("2d");
    const pixelRatio = window.devicePixelRatio || 1;

    canvas.width = Math.floor(c.width * scaleX * pixelRatio);
    canvas.height = Math.floor(c.height * scaleY * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = "high";

    // draw the cropped portion at natural resolution
    ctx.drawImage(
      image,
      c.x * scaleX,
      c.y * scaleY,
      c.width * scaleX,
      c.height * scaleY,
      0,
      0,
      c.width * scaleX,
      c.height * scaleY
    );

    const croppedUrl = canvas.toDataURL("image/png");
    const croppedImage = new Image();
    croppedImage.src = croppedUrl;
    croppedImage.onload = () => {
      setImageObject(croppedImage);
      setImageUrl(croppedUrl);
      setCrop(undefined);
      setCompletedCrop(undefined);
      // clear drawings because coordinates change after cropping
      strokesRef.current = [];
      redrawStrokes();
    };
  };

  // ---------- Rotate image ----------
  // Performs a pixel-perfect rotation using an offscreen canvas, then replaces the
  // displayed image with the rotated data URL. Clearing existing drawings because
  // their coordinates would no longer match the rotated image.
  const rotateImageBy90 = async () => {
    const img = imgRef.current;
    if (!img || !imageUrl) return;

    // Create or reuse the export canvas
    const canvas = exportCanvasRef.current || document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // For 90/270-degree rotation, swap width/height
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    canvas.width = h; // rotated width
    canvas.height = w; // rotated height

    // Translate and rotate so we can draw the image rotated
    // Steps: move origin to center, rotate, draw image centered
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((90 * Math.PI) / 180); // rotate 90 degrees clockwise
    // drawImage expects the top-left of the image; after translate, draw at -w/2, -h/2
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();

    // If filters are important for the rotated result, we can reapply them by
    // drawing into another canvas with ctx.filter. However, since we drew the
    // rendered <img> (which already visually shows filters in the browser), this
    // drawImage copies pixels as displayed. If you rely on CSS filters, they are
    // not applied to the underlying Image pixels; to ensure filters are baked in,
    // draw the original natural image with ctx.filter applied instead. We'll
    // apply filters now to the rotated canvas by compositing:
    if (filterStyle && filterStyle.trim() !== "") {
      // create a second canvas to draw filtered natural image and then rotate the filtered image
      const temp = document.createElement("canvas");
      temp.width = h; // same rotated size
      temp.height = w;
      const tctx = temp.getContext("2d");
      // draw filtered original image onto temp but rotated same way
      tctx.save();
      tctx.translate(temp.width / 2, temp.height / 2);
      tctx.rotate((90 * Math.PI) / 180);
      // apply filter and draw
      tctx.filter = filterStyle;
      tctx.drawImage(img, -w / 2, -h / 2, w, h);
      tctx.restore();

      // replace canvas content with filtered rotated pixels
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(temp, 0, 0);
    }

    // Export the rotated image as data URL and set it as new imageUrl
    const rotatedDataUrl = canvas.toDataURL("image/png");

    const rotatedImage = new Image();
    rotatedImage.src = rotatedDataUrl;
    rotatedImage.onload = () => {
      // Replace displayed image with rotated image object
      setImageObject(rotatedImage);
      setImageUrl(rotatedDataUrl);
      // Reset crop and any existing strokes because coordinates changed
      setCrop(undefined);
      setCompletedCrop(undefined);
      strokesRef.current = [];
      redrawStrokes();
      // Small delay then sync overlay canvas to new image layout
      setTimeout(syncDrawCanvasToImage, 50);
    };
  };

  // ---------- Keep overlay synced when filters/image change ----------
  useEffect(() => {
    setTimeout(syncDrawCanvasToImage, 50);
  }, [filters, imageUrl, completedCrop]);

  // ---------- Render ----------
  return (
    <div className="text-black flex flex-col items-center justify-center w-full lg:w-2/3 p-4 font-sans antialiased">
      <div
        className={`imageBox ${
          isDark ? "bg-slate-700" : "bg-[#f0eeee]"
        } rounded-2xl p-6 md:p-5 w-full text-center shadow-lg`}
      >
        <h1
          className={`text-2xl font-semibold text-left ${
            isDark ? "text-[#6ac3ff]" : "text-[#1f5172]"
          } mb-3`}
        >
          Upload Image
        </h1>

        <div
          ref={wrapperRef}
          className="border-4 max-w-[800px] min-h-96 max-h-[580px] border-dashed border-gray-300 rounded-xl overflow-hidden p-4 flex items-center justify-center mx-auto relative"
        >
          {imageUrl ? (
            <div className="relative w-full flex justify-center items-start">
              {/* Rotate button placed top-right inside the wrapper */}
              <div className="absolute top-3 right-3 z-20">
                <button
                  onClick={rotateImageBy90}
                  title="Rotate 90° clockwise"
                  className="py-1 px-3 bg-white/90 rounded-md shadow-md hover:bg-white"
                >
                  {/* Simple rotate icon (SVG) */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M23 4v6h-6"></path>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                  </svg>
                </button>
              </div>

              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
              >
                <img
                  src={imageUrl}
                  ref={imgRef}
                  alt="Image to crop"
                  style={{
                    maxHeight: "580px",
                    maxWidth: "100%",
                    filter: filterStyle,
                    display: "block",
                  }}
                />
              </ReactCrop>

              {/* Drawing canvas overlay: position controlled programmatically to exactly match the image */}
              <canvas
                ref={drawCanvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                // Only intercept pointer events when drawing is enabled
                style={{ pointerEvents: drawEnabled ? "auto" : "none" }}
              />
            </div>
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

        {/* Drawing toolbar */}
        <div className="mt-4 flex flex-wrap gap-3 items-center justify-center">
          <button
            onClick={() => {
              setDrawEnabled((v) => !v);
              // if enabling drawing, ensure canvas positioned correctly
              setTimeout(() => syncDrawCanvasToImage(), 30);
            }}
            className={`py-1 px-3 rounded-md font-medium ${
              drawEnabled ? "bg-green-600 text-white" : "bg-gray-200"
            }`}
          >
            {drawEnabled ? "Drawing: On" : "Enable Drawing"}
          </button>

          <label className="flex items-center gap-2">
            <input
              type="color"
              value={brushColor}
              onChange={(e) => setBrushColor(e.target.value)}
              disabled={!drawEnabled || isErasing}
            />
          </label>

          <label className="flex items-center gap-2">
            <span className={`${isDark ? "text-white" : "text-black"} text-sm`}>
              Size
            </span>
            <input
              type="range"
              min={1}
              max={80}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
            />
          </label>

          <button
            onClick={() => setIsErasing((e) => !e)}
            className={`py-1 px-3 rounded-md font-medium ${
              isErasing ? "bg-yellow-500 text-white" : "bg-gray-200"
            }`}
            disabled={!drawEnabled}
          >
            {isErasing ? "Eraser" : "Brush"}
          </button>

          <button
            onClick={handleUndo}
            className="py-1 px-3 rounded-md bg-gray-200"
            disabled={strokesRef.current.length === 0}
          >
            Undo
          </button>
          <button
            onClick={handleClearDraw}
            className="py-1 px-3 rounded-md bg-gray-200"
            disabled={strokesRef.current.length === 0}
          >
            Clear Drawings
          </button>
        </div>
      </div>

      <canvas ref={exportCanvasRef} className="hidden" />
    </div>
  );
}

// import React, { useState, useRef, useEffect } from "react";
// import { PhotoIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
// import { saveAs } from "file-saver";
// import ReactCrop from "react-image-crop";
// import "react-image-crop/dist/ReactCrop.css";

// // Full revised ImageContainer component
// // Fixes canvas positioning/sizing issues so drawing is always visible while drawing
// // Keeps: filters, cropping, download, drawing (brush/eraser/undo/clear), and high-res export

// export default function ImageContainer({ filters, isDark }) {
//   const [imageUrl, setImageUrl] = useState(null);
//   const imgRef = useRef(null);
//   const drawCanvasRef = useRef(null); // visible drawing layer
//   const exportCanvasRef = useRef(null); // offscreen canvas used for export/crop
//   const wrapperRef = useRef(null); // wrapper around crop + img for positioning

//   const [imageObject, setImageObject] = useState(null);
//   const [crop, setCrop] = useState();
//   const [completedCrop, setCompletedCrop] = useState(null);

//   // Drawing states
//   const [drawEnabled, setDrawEnabled] = useState(false);
//   const [isErasing, setIsErasing] = useState(false);
//   const [brushColor, setBrushColor] = useState("#ff0000");
//   const [brushSize, setBrushSize] = useState(6);
//   const strokesRef = useRef([]); // array of stroke objects
//   const currentStrokeRef = useRef(null);

//   // Build CSS filter string
//   const filterStyle = `
//     blur(${filters.blur}px)
//     grayscale(${filters.grayScale}%)
//     brightness(${filters.brightness}%)
//     contrast(${filters.contrast}%)
//     hue-rotate(${filters.hueRotate}deg)
//     invert(${filters.invert}%)
//     opacity(${filters.opacity}%)
//     saturate(${filters.saturate}%)
//     sepia(${filters.sepia}%)
//   `;

//   const handleImageUpload = (event) => {
//     const file = event.target.files[0];
//     if (file) {
//       const newImageUrl = URL.createObjectURL(file);
//       setImageUrl(newImageUrl);

//       const image = new Image();
//       image.src = newImageUrl;
//       image.onload = () => {
//         setImageObject(image);
//         // clear any previous drawings
//         strokesRef.current = [];
//         // small timeout to let React render the image and then sync canvas
//         setTimeout(syncDrawCanvasToImage, 50);
//       };
//       image.onerror = () => {
//         console.error("Failed to load image.");
//       };
//     }
//   };

//   // Sync the visible drawing canvas to exactly overlay the displayed image.
//   // This fixes the problem where the canvas appears at a different size/position
//   const syncDrawCanvasToImage = () => {
//     const img = imgRef.current;
//     const canvas = drawCanvasRef.current;
//     const wrapper = wrapperRef.current;
//     if (!img || !canvas || !wrapper) return;

//     const imgRect = img.getBoundingClientRect();
//     const wrapperRect = wrapper.getBoundingClientRect();
//     const dpr = window.devicePixelRatio || 1;

//     // Compute canvas position relative to wrapper
//     const left = imgRect.left - wrapperRect.left;
//     const top = imgRect.top - wrapperRect.top;

//     // Set CSS size to match displayed image size
//     const dispW = Math.max(1, Math.round(imgRect.width));
//     const dispH = Math.max(1, Math.round(imgRect.height));

//     // Backing store for crisp lines on high-DPI
//     canvas.style.position = 'absolute';
//     canvas.style.left = `${left}px`;
//     canvas.style.top = `${top}px`;
//     canvas.style.width = `${dispW}px`;
//     canvas.style.height = `${dispH}px`;
//     canvas.style.zIndex = 5; // above image and crop handles

//     // Set internal pixel size scaled by devicePixelRatio
//     canvas.width = Math.floor(dispW * dpr);
//     canvas.height = Math.floor(dispH * dpr);

//     const ctx = canvas.getContext('2d');
//     ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

//     // Repaint strokes onto resized canvas
//     redrawStrokes();
//   };

//   useEffect(() => {
//     // Whenever window resized or crop changed, resync canvas
//     const onResize = () => syncDrawCanvasToImage();
//     window.addEventListener('resize', onResize);

//     // Also observe the image size changes using ResizeObserver so we react to layout changes
//     let ro;
//     if (imgRef.current) {
//       ro = new ResizeObserver(() => syncDrawCanvasToImage());
//       ro.observe(imgRef.current);
//     }

//     // ensure sync after mount
//     setTimeout(syncDrawCanvasToImage, 100);

//     return () => {
//       window.removeEventListener('resize', onResize);
//       if (ro && imgRef.current) ro.unobserve(imgRef.current);
//     };
//   }, [imageUrl, completedCrop, drawEnabled]);

//   // Redraw strokes onto visible canvas (strokes stored in displayed coordinates)
//   const redrawStrokes = () => {
//     const canvas = drawCanvasRef.current;
//     if (!canvas) return;
//     const ctx = canvas.getContext('2d');

//     // Clear (in CSS pixels because transform is set)
//     const cssW = parseFloat(canvas.style.width) || canvas.width;
//     const cssH = parseFloat(canvas.style.height) || canvas.height;
//     ctx.clearRect(0, 0, cssW, cssH);

//     ctx.lineJoin = 'round';
//     ctx.lineCap = 'round';

//     for (const s of strokesRef.current) {
//       if (!s.points || s.points.length === 0) continue;
//       ctx.lineWidth = s.size;
//       if (s.eraser) {
//         ctx.save();
//         ctx.globalCompositeOperation = 'destination-out';
//         ctx.beginPath();
//         ctx.moveTo(s.points[0].x, s.points[0].y);
//         for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
//         ctx.stroke();
//         ctx.restore();
//       } else {
//         ctx.strokeStyle = s.color;
//         ctx.beginPath();
//         ctx.moveTo(s.points[0].x, s.points[0].y);
//         for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
//         ctx.stroke();
//       }
//     }
//   };

//   // Utility to get pointer position relative to top-left of the displayed image in CSS pixels
//   const getLocalPointerPos = (e) => {
//     const canvas = drawCanvasRef.current;
//     if (!canvas) return { x: 0, y: 0 };
//     const rect = canvas.getBoundingClientRect();
//     return { x: e.clientX - rect.left, y: e.clientY - rect.top };
//   };

//   const handlePointerDown = (e) => {
//     if (!drawEnabled) return;
//     e.preventDefault();
//     const canvas = drawCanvasRef.current;
//     if (canvas && e.pointerId != null) canvas.setPointerCapture(e.pointerId);

//     currentStrokeRef.current = {
//       points: [],
//       color: brushColor,
//       size: brushSize,
//       eraser: isErasing,
//     };
//     const p = getLocalPointerPos(e);
//     currentStrokeRef.current.points.push(p);

//     // draw a dot immediately so users see feedback
//     const ctx = canvas.getContext('2d');
//     ctx.lineJoin = 'round';
//     ctx.lineCap = 'round';
//     ctx.lineWidth = brushSize;
//     if (isErasing) {
//       ctx.save();
//       ctx.globalCompositeOperation = 'destination-out';
//       ctx.beginPath();
//       ctx.moveTo(p.x, p.y);
//       ctx.lineTo(p.x + 0.1, p.y + 0.1);
//       ctx.stroke();
//       ctx.restore();
//     } else {
//       ctx.strokeStyle = brushColor;
//       ctx.beginPath();
//       ctx.moveTo(p.x, p.y);
//       ctx.lineTo(p.x + 0.1, p.y + 0.1);
//       ctx.stroke();
//     }
//   };

//   const handlePointerMove = (e) => {
//     if (!currentStrokeRef.current) return;
//     e.preventDefault();
//     const p = getLocalPointerPos(e);
//     const s = currentStrokeRef.current;
//     s.points.push(p);

//     // incremental draw to canvas for instant feedback
//     const canvas = drawCanvasRef.current;
//     const ctx = canvas.getContext('2d');
//     ctx.lineJoin = 'round';
//     ctx.lineCap = 'round';
//     ctx.lineWidth = s.size;

//     if (s.eraser) {
//       ctx.save();
//       ctx.globalCompositeOperation = 'destination-out';
//       ctx.beginPath();
//       const pts = s.points;
//       ctx.moveTo(pts[0].x, pts[0].y);
//       for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
//       ctx.stroke();
//       ctx.restore();
//     } else {
//       ctx.strokeStyle = s.color;
//       ctx.beginPath();
//       const pts = s.points;
//       ctx.moveTo(pts[0].x, pts[0].y);
//       for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
//       ctx.stroke();
//     }
//   };

//   const handlePointerUp = (e) => {
//     if (!currentStrokeRef.current) return;
//     const canvas = drawCanvasRef.current;
//     if (canvas && e.pointerId != null) canvas.releasePointerCapture(e.pointerId);

//     // push stroke into stack
//     strokesRef.current.push(currentStrokeRef.current);
//     currentStrokeRef.current = null;
//   };

//   const handleUndo = () => {
//     strokesRef.current.pop();
//     redrawStrokes();
//   };
//   const handleClearDraw = () => {
//     strokesRef.current = [];
//     redrawStrokes();
//   };

//   // Compose high-res export: image (with filters) + scaled strokes
//   const handleDownload = () => {
//     const img = imgRef.current;
//     if (!img || !imageUrl) return;

//     const naturalW = img.naturalWidth;
//     const naturalH = img.naturalHeight;

//     const exportCanvas = exportCanvasRef.current || document.createElement('canvas');
//     exportCanvas.width = naturalW;
//     exportCanvas.height = naturalH;
//     const ctx = exportCanvas.getContext('2d');

//     // draw image with filters applied
//     ctx.filter = filterStyle;
//     ctx.drawImage(img, 0, 0, naturalW, naturalH);

//     // displayed size
//     const dispW = img.clientWidth || naturalW;
//     const dispH = img.clientHeight || naturalH;
//     const scaleX = naturalW / dispW;
//     const scaleY = naturalH / dispH;
//     const avgScale = (scaleX + scaleY) / 2;

//     for (const s of strokesRef.current) {
//       ctx.save();
//       ctx.lineJoin = 'round';
//       ctx.lineCap = 'round';
//       ctx.lineWidth = s.size * avgScale;
//       if (s.eraser) ctx.globalCompositeOperation = 'destination-out';
//       else ctx.globalCompositeOperation = 'source-over';

//       if (!s.eraser) ctx.strokeStyle = s.color;

//       ctx.beginPath();
//       const pts = s.points;
//       if (pts.length > 0) {
//         ctx.moveTo(pts[0].x * scaleX, pts[0].y * scaleY);
//         for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * scaleX, pts[i].y * scaleY);
//         ctx.stroke();
//       }
//       ctx.restore();
//     }

//     exportCanvas.toBlob((blob) => {
//       if (blob) saveAs(blob, 'edited-image.png');
//     }, 'image/png');
//   };

//   // Crop handling
//   const handleCrop = () => {
//     const image = imgRef.current;
//     const c = completedCrop;
//     if (!c || !image) return;

//     const canvas = exportCanvasRef.current || document.createElement('canvas');
//     const scaleX = image.naturalWidth / image.width;
//     const scaleY = image.naturalHeight / image.height;
//     const ctx = canvas.getContext('2d');
//     const pixelRatio = window.devicePixelRatio || 1;

//     canvas.width = Math.floor(c.width * scaleX * pixelRatio);
//     canvas.height = Math.floor(c.height * scaleY * pixelRatio);
//     ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
//     ctx.imageSmoothingQuality = 'high';

//     ctx.drawImage(
//       image,
//       c.x * scaleX,
//       c.y * scaleY,
//       c.width * scaleX,
//       c.height * scaleY,
//       0,
//       0,
//       c.width * scaleX,
//       c.height * scaleY
//     );

//     const croppedUrl = canvas.toDataURL('image/png');
//     const croppedImage = new Image();
//     croppedImage.src = croppedUrl;
//     croppedImage.onload = () => {
//       setImageObject(croppedImage);
//       setImageUrl(croppedUrl);
//       setCrop(undefined);
//       setCompletedCrop(undefined);
//       // clear drawings because coordinates will change
//       strokesRef.current = [];
//       redrawStrokes();
//     };
//   };

//   // When filters or image change, we want to repaint the visible canvas
//   useEffect(() => {
//     // Sync after filters change - might alter visual size/appearance
//     setTimeout(syncDrawCanvasToImage, 50);
//   }, [filters, imageUrl, completedCrop]);

//   return (
//     <div className="text-black flex flex-col items-center justify-center w-full lg:w-2/3 p-4 font-sans antialiased">
//       <div className={`imageBox ${isDark?'bg-slate-700':'bg-[#f0eeee]'} rounded-2xl p-6 md:p-5 w-full text-center shadow-lg`}>
//         <h1 className={`text-2xl font-semibold text-left ${isDark?'text-[#6ac3ff]':'text-[#1f5172]'} mb-3`}>Upload Image</h1>

//         <div
//           ref={wrapperRef}
//           className="border-4 max-w-[800px] min-h-96 max-h-[580px] border-dashed border-gray-300 rounded-xl overflow-hidden p-4 flex items-center justify-center mx-auto relative"
//         >
//           {imageUrl ? (
//             <div className="relative w-full flex justify-center items-start">
//               <ReactCrop crop={crop} onChange={(c) => setCrop(c)} onComplete={(c) => setCompletedCrop(c)}>
//                 <img
//                   src={imageUrl}
//                   ref={imgRef}
//                   alt="Image to crop"
//                   style={{ maxHeight: '580px', maxWidth: '100%', filter: filterStyle, display: 'block' }}
//                 />
//               </ReactCrop>

//               {/* Drawing canvas overlay: position controlled programmatically to exactly match the image */}
//               <canvas
//                 ref={drawCanvasRef}
//                 onPointerDown={handlePointerDown}
//                 onPointerMove={handlePointerMove}
//                 onPointerUp={handlePointerUp}
//                 onPointerCancel={handlePointerUp}
//                 // Only intercept pointer events when drawing is enabled
//                 style={{ pointerEvents: drawEnabled ? 'auto' : 'none' }}
//               />
//             </div>
//           ) : (
//             <p className="text-gray-400 text-lg">Your image will appear here</p>
//           )}
//         </div>

//         <div className="flex flex-col md:flex-row justify-center items-center gap-4 my-2 mt-8">
//           <label htmlFor="file-upload" className="text-sm bg-[#1e546f] text-white flex cursor-pointer justify-center gap-2 items-center font-semibold py-2 px-4 rounded-md hover:bg-[#29698a] transition-colors duration-200 shadow-md">
//             <PhotoIcon className="size-5" />
//             Choose an image
//           </label>
//           <input id="file-upload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

//           {imageUrl && completedCrop && (
//             <button onClick={handleCrop} className="bg-blue-500 text-white flex cursor-pointer justify-center items-center gap-2 text-sm font-semibold py-2 px-4 rounded-md hover:bg-blue-600 transition-colors duration-200 shadow-md">
//               Apply Crop
//             </button>
//           )}

//           {imageUrl && (
//             <button onClick={handleDownload} className="bg-[#34729b] cursor-pointer flex justify-center items-center gap-2 text-sm text-white font-semibold py-2 px-4 rounded-md hover:bg-[#29698a] transition-colors duration-200 shadow-md">
//               <ArrowDownTrayIcon className="size-5" />
//               Download Image
//             </button>
//           )}
//         </div>

//         {/* Drawing toolbar */}
//         <div className="mt-4 flex flex-wrap gap-3 items-center justify-center">
//           <button
//             onClick={() => {
//               setDrawEnabled((v) => !v);
//               // if enabling drawing, ensure canvas positioned correctly
//               setTimeout(() => syncDrawCanvasToImage(), 30);
//             }}
//             className={`py-1 px-3 rounded-md font-medium ${drawEnabled ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
//           >
//             {drawEnabled ? 'Drawing: On' : 'Enable Drawing'}
//           </button>

//           <label className="flex items-center gap-2">
//             <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} disabled={!drawEnabled || isErasing} />
//           </label>

//           <label className="flex items-center gap-2">
//             <span className={`${isDark?"text-white":'text-black'} text-sm`}>Size</span>
//             <input type="range" min={1} max={80} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} />
//           </label>

//           <button onClick={() => setIsErasing((e) => !e)} className={`py-1 px-3 rounded-md font-medium ${isErasing ? 'bg-yellow-500 text-white' : 'bg-gray-200'}`} disabled={!drawEnabled}>
//             {isErasing ? 'Eraser' : 'Brush'}
//           </button>

//           <button onClick={handleUndo} className="py-1 px-3 rounded-md bg-gray-200" disabled={strokesRef.current.length === 0}>Undo</button>
//           <button onClick={handleClearDraw} className="py-1 px-3 rounded-md bg-gray-200" disabled={strokesRef.current.length === 0}>Clear Drawings</button>
//         </div>
//       </div>

//       <canvas ref={exportCanvasRef} className="hidden" />
//     </div>
//   );
// }
