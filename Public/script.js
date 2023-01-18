// socket initialization
var socket = io();


// rooms logic

var users = []
socket.on("usersupdate", client => {
    users = client.users;
    document.getElementById("userlist").innerHTML = "<strong>USERS</strong> <hr>";
    for (var i = 0; i < users.length; i++) {
        document.getElementById("userlist").innerHTML += users[i] + "<br>";
    }
    document.getElementById("code").innerHTML = "\"" + client.roomCode + "\"";
});

var userName = null;
var roomCode = null;
function createRoom() {
    userName = document.getElementById("nameinput").value;
    roomCode = document.getElementById("roominput").value;

    if (userName.length == 0 || roomCode.length == 0) {
        document.getElementById("error").innerHTML = "Please fill in both fields"
        return;
    }
    
    socket.emit("created", {userName, roomCode});
    socket.on("valid", () => {
        users.push(userName);
        document.getElementById("menu").id = "hide";
        document.getElementById("blur").id = "hide";
        return;
    });
    socket.on("invalid", errorMessage => {
        document.getElementById("error").innerHTML = errorMessage;
    });
}


function joinRoom() {
    userName = document.getElementById("nameinput").value;
    roomCode = document.getElementById("roominput").value;

    if (userName.length == 0 || roomCode.length == 0) {
        document.getElementById("error").innerHTML = "Please fill in both fields"
        return;
    }   

    socket.emit("joined", {userName, roomCode});
    socket.on("valid", () => {
        document.getElementById("menu").id = "hide";
        document.getElementById("blur").id = "hide";
        return;
    });
    socket.on("invalid", errorMessage => {
        document.getElementById("error").innerHTML = errorMessage;
    });
}

function translation() {
    if (document.getElementById("container").style.left == "0px") {
        document.getElementById("container").style.left = "-200px";

        document.getElementById("arrowL").innerHTML = "<strong>></strong>";
        document.getElementById("arrowL").id = "arrowR";
        return;
    }
    document.getElementById("container").style.left = "0px";

    document.getElementById("arrowR").innerHTML = "<strong><</strong>";
    document.getElementById("arrowR").id = "arrowL";
}

// draw logic

// configuration 
var canvas = document.querySelector(".whiteboard");
var context = canvas.getContext("2d");
var tool = "draw";
var idTempTool = "draw";
var idTempColor = "black";
var drawing = false;
var erasing = false;
var current = { color: "black", strokeSize: 10 };

function toolCurrent(id) {
    tool = id;
    document.getElementById(idTempTool).firstChild.className = "tool"
    document.getElementById(id).firstChild.className = "tool2"
    idTempTool = id
}

document.getElementById("slider").oninput = () => {
    current.strokeSize = document.getElementById("slider").value;
}

function colorChange(id) {
    current.color = id
    document.getElementById(idTempColor).className = "color"
    document.getElementById(id).className = "color2"
    idTempColor = id;
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

function eraseLine(x, y, radius, emit) {

    context.beginPath();
    context.arc(x, y, radius, 0, 2 * Math.PI, false);
    context.closePath();

    context.save();
    context.clip();
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();

    if (!emit) {
        return;
    }
    
    var w = canvas.width;
    var h = canvas.height;

    socket.emit("erasing", {x: x / w, y: y / h, radius}); 
}

function onMouseDown(e) {
    if (tool == "draw") {
        drawing = true;
        current.x = e.clientX || e.touches[0].clientX;
        current.y = e.clientY || e.touches[0].clientY;
    }
    else if (tool == "erase") {
        erasing = true;
    }
}


function onMouseUp(e) {
    if (erasing) {
        erasing = false;
        eraseLine(e.clientX, e.clientY, current.strokeSize, true);
    }
    else if(drawing) {
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
}

function onMouseMove(e) {
    if (erasing) {
        eraseLine(e.clientX, e.clientY, current.strokeSize, true)
    }
    else if (drawing) {
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

function onErasingEvent(data) {
    var w = canvas.width;
    var h = canvas.height;
    eraseLine(data.x * w, data.y * h, data.radius);
}
socket.on("erasing", onErasingEvent);