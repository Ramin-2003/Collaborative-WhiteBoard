// socket initialization
var socket = io();
var canvas = document.querySelector(".whiteboard");


// configuration 
var context = canvas.getContext("2d");
var drawing = false;
var current = {
    color: "black"
};

