const express = require("express");
const { REPL_MODE_SLOPPY } = require("repl");
const app = express();
const http = require("http").Server(app); // creating server
const io = require("socket.io")(http);
const port = 3000;

app.use("/", express.static(__dirname + "/public"));

var rooms = [];

const onConnection = socket => {
    socket.on("create", user => {
        socket.join(user.roomCode);
        rooms.push(user.roomCode);
        socket.on("drawing", data => socket.broadcast.to(user.roomCode).emit("drawing", data)); // broadcast data to all clients in room
    });
};

io.on("connection", onConnection);

http.listen(port, () => {
    console.log(`Server has started on port ${port}.`);
});