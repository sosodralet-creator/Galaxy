const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Game state
let planets = [
  { id: 1, name: 'Terra', x: 400, y: 300, owner: null, resources: { metal: 1000, energy: 500 }, buildings: { mine: 1, power: 1, shipyard: 0 }, army: { fighter: 20 } },
  { id: 2, name: 'Vega', x: 900, y: 300, owner: null, resources: { metal: 800, energy: 400 }, buildings: { mine: 0, power: 0, shipyard: 0 }, army: { fighter: 0 } },
  { id: 3, name: 'Zaros', x: 600, y: 600, owner: null, resources: { metal: 500, energy: 300 }, buildings: { mine: 0, power: 0, shipyard: 0 }, army: { fighter: 0 } },
];

let fleets = [];
let players = {};

io.on('connection', socket => {
  console.log('connect', socket.id);
  
  // assign starter planet
  const starter = planets.find(p => p.owner === null);
  if (starter) {
    starter.owner = socket.id;
    players[socket.id] = { id: socket.id, name: `Player-${socket.id.slice(0,4)}`, planetId: starter.id };
  }

  socket.emit('state', { planets, fleets, players });

  socket.on('build', ({ planetId, building }) => {
    const planet = planets.find(p => p.id === planetId);
    if (planet && planet.owner === socket.id) {
      planet.buildings[building] = (planet.buildings[building] || 0) + 1;
      io.emit('state', { planets, fleets, players });
    }
  });

  socket.on('sendFleet', ({ from, to }) => {
    const src = planets.find(p => p.id === from);
    const dst = planets.find(p => p.id === to);
    if (!src || !dst || src.owner !== socket.id) return;
    fleets.push({ id: Date.now(), from, to, progress: 0, owner: socket.id });
  });

  socket.on('disconnect', () => {
    console.log('disconnect', socket.id);
  });
});

// Tick loop
setInterval(() => {
  fleets.forEach(f => {
    f.progress += 0.02; // adjust speed
    if (f.progress >= 1) {
      const dst = planets.find(p => p.id === f.to);
      if (dst) {
        dst.owner = f.owner;
      }
      f.done = true;
    }
  });
  fleets = fleets.filter(f => !f.done);
  io.emit('state', { planets, fleets, players });
}, 50);

server.listen(3000, () => console.log('Server running on http://localhost:3000'));
