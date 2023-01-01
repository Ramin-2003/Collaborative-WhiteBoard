const express = require("express");
const app = express();
const http = require("http").Server(app); // creating server
const io = require("socket.io")(http);
const port = 3000;

app.use("/", express.static(__dirname + "/public"));

const onConnection = socket => {
    socket.on("drawing", data => socket.broadcast.emit("drawing", data)); // broadcast data to all clients in room
};

io.on("connection", onConnection);

http.listen(port, () => {
    console.log(`Server has started on port ${port}.`);
});