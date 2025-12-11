const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

let planets = [
  { id: 1, name: "Terra", x: 400, y: 300 },
  { id: 2, name: "Vega",  x: 1000, y: 300 },
  { id: 3, name: "Zaros", x: 700, y: 600 }
];

let fleets = [];

// -------- UPDATE LOOP --------
setInterval(() => {
  fleets.forEach(f => {
    f.progress += 1;
  });

  fleets = fleets.filter(f => f.progress < 100);

  io.emit("update", { planets, fleets });
}, 50);

// -------- SOCKET --------
io.on("connection", socket => {
  socket.emit("update", { planets, fleets });

  socket.on("sendFleet", ({ from, to }) => {
    if (!from || !to) return;

    fleets.push({
      id: Date.now(),
      from,
      to,
      progress: 0
    });
  });
});

http.listen(3000, () => console.log("Server online → http://localhost:3000"));
