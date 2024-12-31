import React, { useState, useEffect } from "react";

interface Props {
  users: string[];
  roomCode: string;
}

export default function UserList({ users, roomCode }: Props) {
  const [userList, setUserList] = useState(users);
  const [isListOpen, setIsListOpen] = useState(true);

  const container = isListOpen ? "containerR" : "containerL";
  const arrow = isListOpen ? "arrowL" : "arrowR";
  const icon = isListOpen ? "<" : ">";

  function handleClick(): void {
    setIsListOpen(!isListOpen);
  }

  useEffect(() => {
    setUserList(users);
  }, [users]);

  return (
    <>
      <div id={container}>
        <div id="userlist">
          <strong>USERS</strong> <hr />
          {userList.map((user, index) => (
            <React.Fragment key={index}>
              {user}
              <br />
            </React.Fragment>
          ))}
        </div>
        <span id="roomcode">
          <h3>
            <hr />
            <strong>Room Code</strong>
          </h3>
          <p id="code">{roomCode}</p>
        </span>
      </div>
      <button onClick={handleClick} id={arrow}>
        <strong> {icon} </strong>
      </button>
    </>
  );
}
