import React, { useState, useRef, useEffect } from "react";
import { PhotoIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { saveAs } from "file-saver";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

// Full revised ImageContainer component
// Fixes canvas positioning/sizing issues so drawing is always visible while drawing
// Keeps: filters, cropping, download, drawing (brush/eraser/undo/clear), and high-res export

export default function ImageContainer({ filters }) {
  const [imageUrl, setImageUrl] = useState(null);
  const imgRef = useRef(null);
  const drawCanvasRef = useRef(null); // visible drawing layer
  const exportCanvasRef = useRef(null); // offscreen canvas used for export/crop
  const wrapperRef = useRef(null); // wrapper around crop + img for positioning

  const [imageObject, setImageObject] = useState(null);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);

  // Drawing states
  const [drawEnabled, setDrawEnabled] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [brushColor, setBrushColor] = useState("#ff0000");
  const [brushSize, setBrushSize] = useState(6);
  const strokesRef = useRef([]); // array of stroke objects
  const currentStrokeRef = useRef(null);

  // Build CSS filter string
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

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const newImageUrl = URL.createObjectURL(file);
      setImageUrl(newImageUrl);

      const image = new Image();
      image.src = newImageUrl;
      image.onload = () => {
        setImageObject(image);
        // clear any previous drawings
        strokesRef.current = [];
        // small timeout to let React render the image and then sync canvas
        setTimeout(syncDrawCanvasToImage, 50);
      };
      image.onerror = () => {
        console.error("Failed to load image.");
      };
    }
  };

  // Sync the visible drawing canvas to exactly overlay the displayed image.
  // This fixes the problem where the canvas appears at a different size/position
  const syncDrawCanvasToImage = () => {
    const img = imgRef.current;
    const canvas = drawCanvasRef.current;
    const wrapper = wrapperRef.current;
    if (!img || !canvas || !wrapper) return;

    const imgRect = img.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Compute canvas position relative to wrapper
    const left = imgRect.left - wrapperRect.left;
    const top = imgRect.top - wrapperRect.top;

    // Set CSS size to match displayed image size
    const dispW = Math.max(1, Math.round(imgRect.width));
    const dispH = Math.max(1, Math.round(imgRect.height));

    // Backing store for crisp lines on high-DPI
    canvas.style.position = 'absolute';
    canvas.style.left = `${left}px`;
    canvas.style.top = `${top}px`;
    canvas.style.width = `${dispW}px`;
    canvas.style.height = `${dispH}px`;
    canvas.style.zIndex = 5; // above image and crop handles

    // Set internal pixel size scaled by devicePixelRatio
    canvas.width = Math.floor(dispW * dpr);
    canvas.height = Math.floor(dispH * dpr);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Repaint strokes onto resized canvas
    redrawStrokes();
  };

  useEffect(() => {
    // Whenever window resized or crop changed, resync canvas
    const onResize = () => syncDrawCanvasToImage();
    window.addEventListener('resize', onResize);

    // Also observe the image size changes using ResizeObserver so we react to layout changes
    let ro;
    if (imgRef.current) {
      ro = new ResizeObserver(() => syncDrawCanvasToImage());
      ro.observe(imgRef.current);
    }

    // ensure sync after mount
    setTimeout(syncDrawCanvasToImage, 100);

    return () => {
      window.removeEventListener('resize', onResize);
      if (ro && imgRef.current) ro.unobserve(imgRef.current);
    };
  }, [imageUrl, completedCrop, drawEnabled]);

  // Redraw strokes onto visible canvas (strokes stored in displayed coordinates)
  const redrawStrokes = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Clear (in CSS pixels because transform is set)
    const cssW = parseFloat(canvas.style.width) || canvas.width;
    const cssH = parseFloat(canvas.style.height) || canvas.height;
    ctx.clearRect(0, 0, cssW, cssH);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (const s of strokesRef.current) {
      if (!s.points || s.points.length === 0) continue;
      ctx.lineWidth = s.size;
      if (s.eraser) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.strokeStyle = s.color;
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
        ctx.stroke();
      }
    }
  };

  // Utility to get pointer position relative to top-left of the displayed image in CSS pixels
  const getLocalPointerPos = (e) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

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

    // draw a dot immediately so users see feedback
    const ctx = canvas.getContext('2d');
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = brushSize;
    if (isErasing) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
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

    // incremental draw to canvas for instant feedback
    const canvas = drawCanvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = s.size;

    if (s.eraser) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
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
    if (canvas && e.pointerId != null) canvas.releasePointerCapture(e.pointerId);

    // push stroke into stack
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

  // Compose high-res export: image (with filters) + scaled strokes
  const handleDownload = () => {
    const img = imgRef.current;
    if (!img || !imageUrl) return;

    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;

    const exportCanvas = exportCanvasRef.current || document.createElement('canvas');
    exportCanvas.width = naturalW;
    exportCanvas.height = naturalH;
    const ctx = exportCanvas.getContext('2d');

    // draw image with filters applied
    ctx.filter = filterStyle;
    ctx.drawImage(img, 0, 0, naturalW, naturalH);

    // displayed size
    const dispW = img.clientWidth || naturalW;
    const dispH = img.clientHeight || naturalH;
    const scaleX = naturalW / dispW;
    const scaleY = naturalH / dispH;
    const avgScale = (scaleX + scaleY) / 2;

    for (const s of strokesRef.current) {
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.lineWidth = s.size * avgScale;
      if (s.eraser) ctx.globalCompositeOperation = 'destination-out';
      else ctx.globalCompositeOperation = 'source-over';

      if (!s.eraser) ctx.strokeStyle = s.color;

      ctx.beginPath();
      const pts = s.points;
      if (pts.length > 0) {
        ctx.moveTo(pts[0].x * scaleX, pts[0].y * scaleY);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * scaleX, pts[i].y * scaleY);
        ctx.stroke();
      }
      ctx.restore();
    }

    exportCanvas.toBlob((blob) => {
      if (blob) saveAs(blob, 'edited-image.png');
    }, 'image/png');
  };

  // Crop handling
  const handleCrop = () => {
    const image = imgRef.current;
    const c = completedCrop;
    if (!c || !image) return;

    const canvas = exportCanvasRef.current || document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const ctx = canvas.getContext('2d');
    const pixelRatio = window.devicePixelRatio || 1;

    canvas.width = Math.floor(c.width * scaleX * pixelRatio);
    canvas.height = Math.floor(c.height * scaleY * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

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

    const croppedUrl = canvas.toDataURL('image/png');
    const croppedImage = new Image();
    croppedImage.src = croppedUrl;
    croppedImage.onload = () => {
      setImageObject(croppedImage);
      setImageUrl(croppedUrl);
      setCrop(undefined);
      setCompletedCrop(undefined);
      // clear drawings because coordinates will change
      strokesRef.current = [];
      redrawStrokes();
    };
  };

  // When filters or image change, we want to repaint the visible canvas
  useEffect(() => {
    // Sync after filters change - might alter visual size/appearance
    setTimeout(syncDrawCanvasToImage, 50);
  }, [filters, imageUrl, completedCrop]);

  return (
    <div className="text-black flex flex-col items-center justify-center w-full lg:w-2/3 p-4 font-sans antialiased">
      <div className="imageBox bg-white rounded-2xl p-6 md:p-5 w-full text-center shadow-lg">
        <h1 className="text-2xl font-semibold text-left text-[#1f5172] mb-3">Upload Image</h1>

        <div
          ref={wrapperRef}
          className="border-4 max-w-[800px] min-h-96 max-h-[580px] border-dashed border-gray-300 rounded-xl overflow-hidden p-4 flex items-center justify-center mx-auto relative"
        >
          {imageUrl ? (
            <div className="relative w-full flex justify-center items-start">
              <ReactCrop crop={crop} onChange={(c) => setCrop(c)} onComplete={(c) => setCompletedCrop(c)}>
                <img
                  src={imageUrl}
                  ref={imgRef}
                  alt="Image to crop"
                  style={{ maxHeight: '580px', maxWidth: '100%', filter: filterStyle, display: 'block' }}
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
                style={{ pointerEvents: drawEnabled ? 'auto' : 'none' }}
              />
            </div>
          ) : (
            <p className="text-gray-400 text-lg">Your image will appear here</p>
          )}
        </div>

        <div className="flex flex-col md:flex-row justify-center items-center gap-4 my-2 mt-8">
          <label htmlFor="file-upload" className="text-sm bg-[#1e546f] text-white flex cursor-pointer justify-center gap-2 items-center font-semibold py-2 px-4 rounded-md hover:bg-[#29698a] transition-colors duration-200 shadow-md">
            <PhotoIcon className="size-5" />
            Choose an image
          </label>
          <input id="file-upload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

          {imageUrl && completedCrop && (
            <button onClick={handleCrop} className="bg-blue-500 text-white flex cursor-pointer justify-center items-center gap-2 text-sm font-semibold py-2 px-4 rounded-md hover:bg-blue-600 transition-colors duration-200 shadow-md">
              Apply Crop
            </button>
          )}

          {imageUrl && (
            <button onClick={handleDownload} className="bg-[#34729b] cursor-pointer flex justify-center items-center gap-2 text-sm text-white font-semibold py-2 px-4 rounded-md hover:bg-[#29698a] transition-colors duration-200 shadow-md">
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
            className={`py-1 px-3 rounded-md font-medium ${drawEnabled ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
          >
            {drawEnabled ? 'Drawing: On' : 'Enable Drawing'}
          </button>

          <label className="flex items-center gap-2">
            <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} disabled={!drawEnabled || isErasing} />
          </label>

          <label className="flex items-center gap-2">
            <span className="text-sm">Size</span>
            <input type="range" min={1} max={80} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} />
          </label>

          <button onClick={() => setIsErasing((e) => !e)} className={`py-1 px-3 rounded-md font-medium ${isErasing ? 'bg-yellow-500 text-white' : 'bg-gray-200'}`} disabled={!drawEnabled}>
            {isErasing ? 'Eraser' : 'Brush'}
          </button>

          <button onClick={handleUndo} className="py-1 px-3 rounded-md bg-gray-200" disabled={strokesRef.current.length === 0}>Undo</button>
          <button onClick={handleClearDraw} className="py-1 px-3 rounded-md bg-gray-200" disabled={strokesRef.current.length === 0}>Clear Drawings</button>
        </div>
      </div>

      <canvas ref={exportCanvasRef} className="hidden" />
    </div>
  );
}