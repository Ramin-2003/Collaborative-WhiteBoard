import { useState } from "react";
import eraserIcon from "../assets/eraser.png";
import drawerIcon from "../assets/drawer.png";

interface Props {
  handleColorChange: (color: string) => void;
  handleToolChange: (tool: string) => void;
  handleSizeChange: (size: number) => void;
}

export default function UserInterface({
  handleColorChange,
  handleToolChange,
  handleSizeChange,
}: Props) {
  const [selectedColor, setSelectedColor] = useState("black");
  const [selectedTool, setSelectedTool] = useState("drawer");
  const [sliderValue, setSliderValue] = useState(10);

  function onColorChange(color: string): void {
    setSelectedColor(color);
    handleColorChange(color);
  }

  function onToolChange(tool: string): void {
    setSelectedTool(tool);
    handleToolChange(tool);
  }

  function onSizeChange(size: number): void {
    setSliderValue(size);
    handleSizeChange(size);
  }

  return (
    <div id="UI">
      <div id="buttons">
        {["black", "red", "green", "blue", "yellow"].map((color) => (
          <button
            key={color}
            onClick={() => onColorChange(color)}
            className={selectedColor === color ? "color2" : "color"}
            id={color}
          />
        ))}
      </div>

      <div id="tools">
        <button
          onClick={() => onToolChange("eraser")}
          id="erase"
          className={selectedTool === "eraser" ? "tool2" : "tool"}
        >
          <img src={eraserIcon} alt="Eraser" />
        </button>
        <button
          onClick={() => onToolChange("drawer")}
          id="draw"
          className={selectedTool === "drawer" ? "tool2" : "tool"}
        >
          <img src={drawerIcon} alt="Drawer" />
        </button>
      </div>

      <input
        type="range"
        min="1"
        max="55"
        value={sliderValue}
        id="slider"
        onChange={(e) => onSizeChange(Number(e.target.value))}
      />
    </div>
  );
}
