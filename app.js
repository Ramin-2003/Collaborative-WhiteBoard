const express = require("express");
const { SocketAddress } = require("net");
const { disconnect } = require("process");
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
            users: [user.userName],
            identities: [socket.id]
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
                clients[i].identities.push(socket.id);
                io.in(user.roomCode).emit("usersupdate", clients[i]);
                socket.on("drawing", data => socket.broadcast.to(user.roomCode).emit("drawing", data)); // broadcast data to all clients in room
                return;
            }
        }
        io.to(socket.id).emit("invalid");
    })

    socket.on("disconnecting", () => {
        for (var i = 0; i < clients.length; i++) {
            if (socket.rooms.has(clients[i].roomCode)) {
                var index = clients[i].identities.indexOf(socket.id); // get index of socket id same as index of socket username
                clients[i].identities.splice(index, 1);
                clients[i].users.splice(index, 1);
                
                io.in(clients[i].roomCode).emit("usersupdate", clients[i].users) // emit usernames update to all clients in room
                
                if (clients[i].users.length == 0) { // delete room if no more users
                    clients.splice(i,1);
                }
                return;
            }
        }
    })
};
io.on("connection", onConnection);

http.listen(port, () => {
    console.log(`Server has started on port ${port}.`);
});