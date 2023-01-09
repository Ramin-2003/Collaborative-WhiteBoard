const express = require("express");
const { SocketAddress } = require("net");
const { REPL_MODE_SLOPPY } = require("repl");
const app = express();
const http = require("http").Server(app); // creating server
const io = require("socket.io")(http);
const port = 3000;

app.use("/", express.static(__dirname + "/public"));

var clients = [];

const onConnection = socket => {
    socket.on("created", user => {
        for (var i = 0; i < clients.length; i++) {
            if (clients[i].roomCode == user.roomCode) {
                io.to(socket.id).emit("invalid");
                return;
            }
        }
        io.to(socket.id).emit("valid");
        socket.join(user.roomCode);
        var user = {
            roomCode: user.roomCode,
            users: [user.userName]
        };
        clients.push(user);
        socket.on("drawing", data => socket.broadcast.to(user.roomCode).emit("drawing", data)); // broadcast data to all clients in room
    });
    socket.on("joined", user => {
        for (var i = 0; i < clients.length; i++) {
            if (clients[i].roomCode == user.roomCode) {
                io.to(socket.id).emit("valid");
                socket.join(user.roomCode);
                clients[i].users.push(user.userName);
                io.in(user.roomCode).emit("users", clients[i]);
                socket.on("drawing", data => socket.broadcast.to(user.roomCode).emit("drawing", data)); // broadcast data to all clients in room
                return;
            }
        }
        io.to(socket.id).emit("invalid");
    })
};
io.on("connection", onConnection);


http.listen(port, () => {
    console.log(`Server has started on port ${port}.`);
});