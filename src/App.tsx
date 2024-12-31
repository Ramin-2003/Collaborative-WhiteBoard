import { useState, useEffect } from "react";
import Menu from "./components/Menu";
import WhiteBoard from "./components/WhiteBoard";
import UserList from "./components/UserList";
import UserInterface from "./components/UserInterface";
import { io, Socket } from "socket.io-client";

const socket: Socket = io(
  "ws://whiteboard-alb-1288423591.ca-central-1.elb.amazonaws.com"
);
function App() {
  const [showMenu, setShowMenu] = useState(true); // Controls if Menu is shown
  const [users, setUsers] = useState<string[]>([]);
  const [roomCode, setRoomCode] = useState<string>(""); // To store the room code

  const [color, setColor] = useState("black");
  const [tool, setTool] = useState("drawer");
  const [size, setSize] = useState(10);

  useEffect(() => {
    socket.on(
      "usersupdate",
      (data: { identities: string[]; room_code: string; users: string[] }) => {
        if (data) {
          setUsers(data.users); // Update the global user list
          setRoomCode(data.room_code); // Update the room code
        }
      }
    );

    return () => {
      socket.off("usersupdate");
    };
  });

  function handleRoomEnter() {
    setShowMenu(false); // Unmount Menu
  }

  function handleColorChange(color: string) {
    setColor(color);
  }
  function handleToolChange(tool: string) {
    setTool(tool);
  }
  function handleSizeChange(size: number) {
    setSize(size);
  }

  return (
    <div>
      {showMenu && (
        <Menu
          socket={socket}
          handleRoomEnter={handleRoomEnter} // Callback for room creation
        />
      )}
      <UserList users={users} roomCode={roomCode} />
      <UserInterface
        handleColorChange={handleColorChange}
        handleToolChange={handleToolChange}
        handleSizeChange={handleSizeChange}
      />
      <WhiteBoard color={color} strokeSize={size} tool={tool} socket={socket} />
    </div>
  );
}

export default App;
