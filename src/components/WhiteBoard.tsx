import { useState, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";

interface Props {
  color: string;
  strokeSize: number;
  tool: string;
  socket: Socket;
}

function throttle(
  callback: (...args: any[]) => void,
  delay: number
): (...args: any[]) => void {
  let previousCall = new Date().getTime();

  return function (...args: any[]): void {
    const time = new Date().getTime();

    if (time - previousCall >= delay) {
      previousCall = time;
      callback(...args);
    }
  };
}

export default function WhiteBoard({ color, strokeSize, tool, socket }: Props) {
  const [drawing, setDrawing] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [current, setCurrent] = useState({
    x: 0,
    y: 0,
    color: color,
    strokeSize: strokeSize,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const setupCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const context = canvas.getContext("2d");
      if (context) {
        context.lineCap = "round"; // Set initial line cap
        contextRef.current = context;
      }
    };

    setupCanvas(); // Initial setup

    const handleResize = () => {
      setupCanvas(); // Rerun setup after resize to ensure properties are maintained
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const drawLine = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: string,
    strokeSize: number,
    emit: boolean
  ) => {
    const context = contextRef.current;
    if (!context) return;

    context.lineCap = "round";
    context.strokeStyle = color;
    context.lineWidth = strokeSize;

    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.strokeStyle = color;
    context.lineWidth = strokeSize;
    context.stroke();
    context.closePath();

    if (emit) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const w = canvas.width;
      const h = canvas.height;

      socket.emit("drawing", {
        x0: x0 / w,
        y0: y0 / h,
        x1: x1 / w,
        y1: y1 / h,
        color,
        strokeSize,
      });
    }
  };

  const eraseLine = (x: number, y: number, radius: number, emit: boolean) => {
    const context = contextRef.current;
    const canvas = canvasRef.current;
    if (!context || !canvas) return;

    context.beginPath();
    context.arc(x, y, radius, 0, 2 * Math.PI, false);
    context.closePath();

    context.save();
    context.clip();
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();

    if (emit) {
      const w = canvas.width;
      const h = canvas.height;

      socket.emit("erasing", { x: x / w, y: y / h, radius });
    }
  };

  const handleMouseDown = (e: MouseEvent | TouchEvent) => {
    console.log("CLICKED!");
    if (tool === "drawer") {
      setDrawing(true);
      const x = "clientX" in e ? e.clientX : e.touches[0].clientX;
      const y = "clientY" in e ? e.clientY : e.touches[0].clientY;
      setCurrent((prevState) => ({
        ...prevState,
        x: x,
        y: y,
      }));
    } else if (tool === "eraser") {
      setErasing(true);
    }
  };

  const handleMouseUp = (e: MouseEvent | TouchEvent) => {
    if (erasing) {
      setErasing(false);
      const x = "clientX" in e ? e.clientX : e.touches[0].clientX;
      const y = "clientY" in e ? e.clientY : e.touches[0].clientY;
      eraseLine(x, y, current.strokeSize, true);
    } else if (drawing) {
      setDrawing(false);
      const x = "clientX" in e ? e.clientX : e.touches[0].clientX;
      const y = "clientY" in e ? e.clientY : e.touches[0].clientY;
      drawLine(
        current.x,
        current.y,
        x,
        y,
        current.color,
        current.strokeSize,
        true
      );
    }
  };

  const handleMouseMove = throttle((e: MouseEvent | TouchEvent) => {
    if (erasing) {
      const x = "clientX" in e ? e.clientX : e.touches[0].clientX;
      const y = "clientY" in e ? e.clientY : e.touches[0].clientY;
      eraseLine(x, y, current.strokeSize, true);
    } else if (drawing) {
      const x = "clientX" in e ? e.clientX : e.touches[0].clientX;
      const y = "clientY" in e ? e.clientY : e.touches[0].clientY;
      drawLine(
        current.x,
        current.y,
        x,
        y,
        current.color,
        current.strokeSize,
        true
      );
      setCurrent((prevState) => ({
        ...prevState,
        x: x,
        y: y,
      }));
    }
  }, 10);

  const handleDrawingEvent = (data: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = canvas.width;
    const h = canvas.height;
    drawLine(
      data.x0 * w,
      data.y0 * h,
      data.x1 * w,
      data.y1 * h,
      data.color,
      data.strokeSize,
      false
    );
  };

  const handleErasingEvent = (data: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = canvas.width;
    const h = canvas.height;
    eraseLine(data.x * w, data.y * h, data.radius, false);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("mousedown", handleMouseDown as any, false);
    canvas.addEventListener("mouseup", handleMouseUp as any, false);
    canvas.addEventListener("mouseout", handleMouseUp as any, false);
    canvas.addEventListener("mousemove", handleMouseMove as any, false);

    canvas.addEventListener("touchstart", handleMouseDown as any, false);
    canvas.addEventListener("touchend", handleMouseUp as any, false);
    canvas.addEventListener("touchcancel", handleMouseUp as any, false);
    canvas.addEventListener("touchmove", handleMouseMove as any, false);

    socket.on("drawing", handleDrawingEvent);
    socket.on("erasing", handleErasingEvent);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown as any);
      canvas.removeEventListener("mouseup", handleMouseUp as any);
      canvas.removeEventListener("mouseout", handleMouseUp as any);
      canvas.removeEventListener("mousemove", handleMouseMove as any);

      canvas.removeEventListener("touchstart", handleMouseDown as any);
      canvas.removeEventListener("touchend", handleMouseUp as any);
      canvas.removeEventListener("touchcancel", handleMouseUp as any);
      canvas.removeEventListener("touchmove", handleMouseMove as any);

      socket.off("drawing", handleDrawingEvent);
      socket.off("erasing", handleErasingEvent);
    };
  }, [socket, handleMouseDown, handleMouseUp, handleMouseMove]);

  useEffect(() => {
    setCurrent((prev) => ({
      ...prev,
      color: color,
      strokeSize: strokeSize,
    }));
  }, [color, strokeSize]);

  return (
    <>
      <canvas ref={canvasRef} className="whiteboard">
        {" "}
      </canvas>
      <svg width="100%" height="100%" id="grid">
        <pattern
          id="pattern-circles"
          x="0"
          y="0"
          width="50"
          height="50"
          patternUnits="userSpaceOnUse"
          patternContentUnits="userSpaceOnUse"
        >
          <circle
            id="pattern-circle"
            cx="10"
            cy="10"
            r="1.6257413380501518"
            fill="#000"
            fillOpacity="0.5"
          ></circle>
        </pattern>
        <rect
          id="rect"
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="url(#pattern-circles)"
        ></rect>
      </svg>
    </>
  );
}
