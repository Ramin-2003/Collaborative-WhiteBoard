// socket initialization
var socket = io();


// rooms logic

var users = []

const newUser = clients => {
    users = clients.users;
    console.log(users[users.length-1] + " joined");
}
socket.on("users", newUser);

var userName = null;
var roomCode = null;
function createRoom() {
    userName = document.getElementById("nameinput").value;
    roomCode = document.getElementById("roominput").value;
    socket.emit("created", {userName, roomCode});
    socket.on("valid", () => {
        users.push(userName);
        document.getElementById("menu").id = "hide";
        return;
    });
    socket.on("invalid", () => {
        document.getElementById("error").innerHTML = "This room already exists";
    });
}


function joinRoom() {
    userName = document.getElementById("nameinput").value;
    roomCode = document.getElementById("roominput").value;
    socket.emit("joined", {userName, roomCode});
    socket.on("valid", () => {
        document.getElementById("menu").id = "hide";
        return;
    });
    socket.on("invalid", () => {
        document.getElementById("error").innerHTML = "This room does not exist";
    });
}

// draw logic

// configuration 
var canvas = document.querySelector(".whiteboard");
var context = canvas.getContext("2d");
var drawing = false;
var current = { color: "black", strokeSize: "10" };
var idTemp = "black";

document.getElementById("slider").oninput = () => {
    current.strokeSize = document.getElementById("slider").value;
}

function colorChange(id) {
    current.color = id
    document.getElementById(idTemp).className = "color"
    document.getElementById(id).className = "color2"
    idTemp = id;
}

function throttle(callback, delay) {
    var previousCall =  new Date().getTime();
    return function () {
        var time = new Date().getTime();

        if (time - previousCall >= delay) {
            previousCall = time;
            callback.apply(null, arguments);
        }
    };
}

function drawLine(x0, y0, x1, y1, color, strokeSize, emit) {
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.strokeStyle = color;
    context.lineCap = "round";
    context.lineWidth = strokeSize;
    context.stroke();
    context.closePath();

    if (!emit) {
        return;
    }

    var w = canvas.width;
    var h = canvas.height;

    socket.emit("drawing", {
       x0: x0 / w,
       y0: y0 / h,
       x1: x1 / w,
       y1: y1 / h,
       color,
       strokeSize
    });
}

function onMouseDown(e) {
    drawing = true;
    current.x = e.clientX || e.touches[0].clientX;
    current.y = e.clientY || e.touches[0].clientY;
}


function onMouseUp(e) {
    if (!drawing) {
        return;
    }
    drawing = false;
    drawLine(
        current.x,
        current.y,
        e.clientX || e.touches[0].clientX,
        e.clientY || e.touches[0].clientY,
        current.color,
        current.strokeSize,
        true
    );
}

function onMouseMove(e) {
    if (!drawing) {
        return;
    }
    drawLine(
        current.x,
        current.y,
        e.clientX || e.touches[0].clientX,
        e.clientY || e.touches[0].clientY,
        current.color,
        current.strokeSize,
        true
    );
    current.x = e.clientX || e.touches[0].clientX;
    current.y = e.clientY || e.touches[0].clientY;
}

// dekstop events
canvas.addEventListener("mousedown", onMouseDown, false);
canvas.addEventListener("mouseup", onMouseUp, false);
canvas.addEventListener("mouseout", onMouseUp, false);
canvas.addEventListener("mousemove", throttle(onMouseMove, 10), false);


// mobile events
canvas.addEventListener("touchstart", onMouseDown, false);
canvas.addEventListener("touchend", onMouseUp, false);
canvas.addEventListener("touchcancel", onMouseUp, false);
canvas.addEventListener("touchmove", throttle(onMouseMove, 10), false);

function onResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
}

window.addEventListener("resize", onResize, false);
onResize();

function onDrawingEvent(data) {
    var w = canvas.width;
    var h = canvas.height;
    drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color, data.strokeSize);
}
socket.on("drawing", onDrawingEvent);