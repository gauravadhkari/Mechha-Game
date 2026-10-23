import WebSocket from "ws";

const socket = new WebSocket("ws://localhost:8080");
socket.on('open', () => {
    console.log("Connected to server");
    socket.send("Hello from Node.js client!");
});

socket.on('message', (data) => {
    
    console.log("Message from server:", data.toString());
});

socket.on('error', (err) => {
    console.error("WebSocket error:", err);
});

socket.on('close', () => {
    console.log("Connection closed");
});