const express = require("express");
const { SocketAddress } = require("net");
const { disconnect } = require("process");
const { REPL_MODE_SLOPPY } = require("repl");
const app = express();
const http = require("http").Server(app); // creating server
const io = require("socket.io")(http, {
    cors: {
        origin: ["http://d239cx6anf1qh8.cloudfront.net", "http://localhost:5173", "http://localhost:10000"],
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"],
        credentials: true
    }
});
const port = 10000;

const { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const dynamoDbClient = new DynamoDBClient({ region: "ca-central-1" });

// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).send("OK");
});

const onConnection = (socket) => {
    socket.on("created", async (user) => {
        try {
            // Check if the room already exists
            const getCommand = new GetItemCommand({
                TableName: "whiteboard", 
                Key: marshall({ room_code: user.roomCode }),
            });
            const roomExists = await dynamoDbClient.send(getCommand);

            if (roomExists.Item) {
                io.to(socket.id).emit("invalid", "Room already exists");
                return;
            }

            // Create a new room
            const newRoom = {
                room_code: user.roomCode,
                users: [user.userName],
                identities: [socket.id],
            };

            const putCommand = new PutItemCommand({
                TableName: "whiteboard",
                Item: marshall(newRoom),
            });
            await dynamoDbClient.send(putCommand);

            io.to(socket.id).emit("valid");
            socket.join(user.roomCode);
            io.in(user.roomCode).emit("usersupdate", newRoom);

            socket.on("drawing", (data) => socket.broadcast.to(user.roomCode).emit("drawing", data));
            socket.on("erasing", (data) => socket.broadcast.to(user.roomCode).emit("erasing", data));
        } catch (error) {
            console.error("Error creating room:", error);
        }
    });

    socket.on("joined", async (user) => {
        try {
            // Fetch room from DynamoDB
            const getCommand = new GetItemCommand({
                TableName: "whiteboard",
                Key: marshall({ room_code: user.roomCode }),
            });
            const room = await dynamoDbClient.send(getCommand);

            if (!room.Item) {
                io.to(socket.id).emit("invalid", "Room does not exist");
                return;
            }

            const roomData = unmarshall(room.Item);

            // Update the room with the new user
            roomData.users.push(user.userName);
            roomData.identities.push(socket.id);

            const updateCommand = new UpdateItemCommand({
                TableName: "whiteboard", 
                Key: marshall({ room_code: user.roomCode }),
                UpdateExpression: "SET #users = :users, #identities = :identities",
                ExpressionAttributeNames: { // alias due to reserved names
                    "#users": "users", 
                    "#identities": "identities", 
                },
                ExpressionAttributeValues: marshall({
                    ":users": roomData.users,
                    ":identities": roomData.identities,
                }),
            });
            await dynamoDbClient.send(updateCommand);

            io.to(socket.id).emit("valid");
            socket.join(user.roomCode);
            io.in(user.roomCode).emit("usersupdate", roomData);

            socket.on("drawing", (data) => socket.broadcast.to(user.roomCode).emit("drawing", data));
            socket.on("erasing", (data) => socket.broadcast.to(user.roomCode).emit("erasing", data));
        } catch (error) {
            console.error("Error joining room:", error);
        }
    });

socket.on("disconnecting", async () => {
    try {
        for (const roomCode of socket.rooms) {
            const getCommand = new GetItemCommand({
                TableName: "whiteboard", 
                Key: marshall({ room_code: roomCode }),
            });
            const room = await dynamoDbClient.send(getCommand);

            if (room.Item) {
                const roomData = unmarshall(room.Item);
                const index = roomData.identities.indexOf(socket.id);
                if (index === -1) continue;

                // Remove the user from the room
                roomData.identities.splice(index, 1);
                roomData.users.splice(index, 1);

                if (roomData.users.length === 0) {
                    // Delete the room if no users remain
                    const deleteCommand = new DeleteItemCommand({
                        TableName: "whiteboard", // Replace with your table name
                        Key: marshall({ room_code: roomCode }),
                    });
                    await dynamoDbClient.send(deleteCommand);
                } else {
                    // Update the room if users remain
                    const updateCommand = new UpdateItemCommand({
                        TableName: "whiteboard", // Replace with your table name
                        Key: marshall({ room_code: roomCode }),
                        UpdateExpression: "SET #users = :users, #identities = :identities",
                        ExpressionAttributeNames: { // alias due to reserved names
                            "#users": "users",
                            "#identities": "identities",
                        },
                        ExpressionAttributeValues: marshall({
                            ":users": roomData.users,
                            ":identities": roomData.identities,
                        }),
                    });
                    await dynamoDbClient.send(updateCommand);

                    // Emit the updated room data
                    io.in(roomCode).emit("usersupdate", {
                        roomCode,
                        users: roomData.users,
                        identities: roomData.identities,
                    });
                }

                break;
            }
        }
    } catch (error) {
        console.error("Error disconnecting user:", error);
    }
});
};
io.on("connection", onConnection);

http.listen(port, () => {
    console.log(`Server has started on port ${port}.`);
});