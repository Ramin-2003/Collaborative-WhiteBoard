import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";

interface Props {
  socket: Socket;
  handleRoomEnter: (userName: string) => void;
}

export default function Menu({ socket, handleRoomEnter }: Props) {
  const [userName, setUserName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [menu, setMenu] = useState("menu"); // change ids for
  const [blur, setBlur] = useState("blur"); // exit animation

  useEffect(() => {
    // Attach listeners only once when the component mounts
    socket.on("valid", () => {
      setMenu("hide");
      setBlur("hide");
      setTimeout(() => handleRoomEnter(userName), 700);
    });

    socket.on("invalid", (errorMessage: string) => {
      setError(errorMessage);
    });

    // Clean up the listeners when the component unmounts
    return () => {
      if (socket.connected) {
        socket.off("valid");
        socket.off("invalid");
      }
    };
  }, [socket]);

  function onRoomEnter(action: "created" | "joined"): void {
    if (!userName || !roomCode) {
      setError("Please fill in both fields.");
      return;
    }

    socket.emit(action, { userName, roomCode });
  }

  return (
    <>
      <div id={menu}>
        <div id="box">
          <div id="userinput">
            <h1 className="text">Username:</h1>
            <input
              type="text"
              maxLength={20}
              className="textbox"
              id="nameinput"
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
            />
            <br />
            <br />
            <br />
            <h2 className="text">Room Code:</h2>
            <input
              type="text"
              maxLength={25}
              className="textbox"
              id="roominput"
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value)}
            />
            <br />
            <p id="error">{error}</p>
            <br />
            <br />
            <button onClick={() => onRoomEnter("created")} id="create">
              Create
            </button>
            <button onClick={() => onRoomEnter("joined")} id="join">
              Join
            </button>
          </div>
        </div>
      </div>
      <div id={blur}></div>
    </>
  );
}
