// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req,res) => res.sendFile(path.join(__dirname,'public','index.html')));

// ------------ Game state ------------
const TICK_MS = 500;
let nextFleetId = 1;

const systems = []; // each system = { id, x, y, starName, planets: [...] }
const fleets = [];  // in-flight fleets
const players = {}; // socketId => { id, name, color, planetId }

// helper
function randRange(a,b){ return a + Math.random()*(b-a); }
function distance(a,b){ return Math.hypot(a.x - b.x, a.y - b.y); }

// generate a small galaxy with systems and planets
function generateGalaxy(){
  systems.length = 0;
  // generate 8 systems placed across a big map
  for(let s=0;s<8;s++){
    const sx = 300 + s*220 + (Math.random()*120-60);
    const sy = 200 + (Math.random()*600-300);
    const system = { id: s+1, x: sx, y: sy, starName: `Star ${s+1}`, planets: [] };
    // each system gets 3-6 planets
    const nPlan = 3 + Math.floor(Math.random()*4);
    for(let p=0;p<nPlan;p++){
      const angle = (p / nPlan) * Math.PI*2;
      const orbitRadius = 80 + p*40 + Math.random()*20;
      const px = sx + Math.cos(angle) * orbitRadius;
      const py = sy + Math.sin(angle) * orbitRadius;
      system.planets.push({
        id: `${system.id}-${p+1}`,
        systemId: system.id,
        name: `P${system.id}-${p+1}`,
        x: px, y: py,
        orbitRadius,
        orbitAngle: angle + Math.random()*0.4,
        orbitSpeed: 0.005 + Math.random()*0.01, // radians per tick
        size: 12 + Math.floor(Math.random()*26),
        owner: null,
        resources: { metal: 500 + Math.floor(Math.random()*1500), energy: 200 + Math.floor(Math.random()*800) },
        buildings: { mine: 0, power: 0, lab: 0, shipyard: 0 },
        army: { fighter: 0, frigate:0, destroyer:0 },
      });
    }
    systems.push(system);
  }
}
generateGalaxy();

// find planet helper
function findPlanetById(pid){
  for(const s of systems) for(const p of s.planets) if(p.id === pid) return p;
  return null;
}

// give starter planet to new player (first free)
function assignStarterPlanet(socketId, name, color){
  for(const s of systems){
    for(const p of s.planets){
      if(p.owner === null){
        p.owner = socketId;
        // give some starting army and buildings
        p.buildings.mine = 2; p.buildings.power = 1; p.buildings.shipyard = 1;
        p.resources.metal += 1000; p.resources.energy += 600;
        p.army.fighter = 30; p.army.frigate = 5;
        players[socketId] = { id: socketId, name, color, planetId: p.id };
        return p;
      }
    }
  }
  return null;
}

// fleet travel model
function computeTravelTime(fromPlanet, toPlanet){
  const d = Math.hypot(fromPlanet.x - toPlanet.x, fromPlanet.y - toPlanet.y);
  const base = 800; // pixels per second baseline
  const seconds = Math.max(1.2, Math.ceil(d / base));
  return seconds * 1000;
}

// server tick
setInterval(() => {
  // update orbits (for orbital system mode)
  for(const s of systems){
    for(const p of s.planets){
      p.orbitAngle += p.orbitSpeed * (TICK_MS/16);
      const sx = s.x, sy = s.y;
      p.x = sx + Math.cos(p.orbitAngle) * p.orbitRadius;
      p.y = sy + Math.sin(p.orbitAngle) * p.orbitRadius;
    }
  }

  // update fleet progress
  const now = Date.now();
  for(const f of fleets){
    const elapsed = now - f.startTime;
    f.progress = Math.min(1, elapsed / f.travelMs);
    if(f.progress >= 1 && !f.resolving){
      f.resolving = true;
      // simple battle resolution: compare total ships (fighters +)
      const dest = findPlanetById(f.to);
      if(!dest){ f.done = true; continue; }
      const attackerPower = (f.composition.fighter||0) + (f.composition.frigate||0)*3 + (f.composition.destroyer||0)*8;
      const defenderPower = (dest.army.fighter||0) + (dest.army.frigate||0)*3 + (dest.army.destroyer||0)*8;
      if(attackerPower > defenderPower){
        // attacker wins
        dest.owner = f.owner;
        // leftover becomes 40% of sent
        dest.army.fighter = Math.floor((f.composition.fighter||0)*0.4);
        dest.army.frigate = Math.floor((f.composition.frigate||0)*0.4);
        dest.army.destroyer = Math.floor((f.composition.destroyer||0)*0.4);
      } else {
        // defender holds; lose ~50% defenders
        dest.army.fighter = Math.max(0, Math.floor(dest.army.fighter * 0.5));
        dest.army.frigate = Math.max(0, Math.floor(dest.army.frigate * 0.5));
        dest.army.destroyer = Math.max(0, Math.floor(dest.army.destroyer * 0.5));
      }
      f.done = true;
      // notify later removal
      setTimeout(()=> {
        const idx = fleets.findIndex(ff=>ff.id===f.id);
        if(idx>=0) fleets.splice(idx,1);
      }, 600);
    }
  }

  // broadcast state
  io.emit('state', { systems, fleets, players });

}, TICK_MS);

// ----------------- sockets -----------------
io.on('connection', socket => {
  console.log('connect', socket.id);
  // send initial state
  socket.emit('state', { systems, fleets, players });

  // player registration / choose country
  socket.on('register', ({ name, color }, cb) => {
    const p = assignStarterPlanet(socket.id, name||('P'+socket.id.slice(0,4)), color||('#'+Math.floor(Math.random()*16777215).toString(16)));
    socket.emit('state', { systems, fleets, players });
    if(cb) cb({ ok:true, planetId: p ? p.id : null });
  });

  // build on planet (mine/power/lab/shipyard)
  socket.on('build', ({ planetId, building }, cb) => {
    const pl = findPlanetById(planetId);
    if(!pl) return cb && cb({ ok:false, err:'planet not found' });
    if(pl.owner !== socket.id) return cb && cb({ ok:false, err:'not owner' });
    // costs simplified
    const costs = { mine:{metal:200, energy:80}, power:{metal:150, energy:120}, lab:{metal:400, energy:250}, shipyard:{metal:800, energy:400} };
    const cost = costs[building];
    if(!cost) return cb && cb({ ok:false, err:'unknown building' });
    if(pl.resources.metal < cost.metal || pl.resources.energy < cost.energy) return cb && cb({ ok:false, err:'not enough resources' });
    pl.resources.metal -= cost.metal; pl.resources.energy -= cost.energy;
    pl.buildings[building] = (pl.buildings[building]||0) + 1;
    socket.emit('state', { systems, fleets, players });
    io.emit('state', { systems, fleets, players });
    cb && cb({ ok:true });
  });

  // recruit units on planet
  socket.on('recruit', ({ planetId, unit, qty }, cb) => {
    const pl = findPlanetById(planetId);
    if(!pl) return cb && cb({ ok:false });
    if(pl.owner !== socket.id) return cb && cb({ ok:false, err:'not owner' });
    const unitCosts = { fighter:{metal:20,energy:6}, frigate:{metal:70,energy:26}, destroyer:{metal:200,energy:90} };
    const c = unitCosts[unit];
    if(!c) return cb && cb({ ok:false });
    const totalCostMetal = c.metal * qty, totalCostEnergy = c.energy * qty;
    if(pl.resources.metal < totalCostMetal || pl.resources.energy < totalCostEnergy) return cb && cb({ ok:false, err:'not enough' });
    pl.resources.metal -= totalCostMetal; pl.resources.energy -= totalCostEnergy;
    pl.army[unit] = (pl.army[unit]||0) + qty;
    io.emit('state', { systems, fleets, players });
    cb && cb({ ok:true });
  });

  // send fleet
  socket.on('sendFleet', ({ from, to, composition }, cb) => {
    const src = findPlanetById(from);
    const dst = findPlanetById(to);
    if(!src || !dst) return cb && cb({ ok:false });
    if(src.owner !== socket.id) return cb && cb({ ok:false, err:'not owner' });
    // verify composition available
    for(const t of ['fighter','frigate','destroyer']){
      const q = composition[t] || 0;
      if(q > (src.army[t]||0)) return cb && cb({ ok:false, err:'not enough units ' + t });
    }
    // reserve units
    for(const t of ['fighter','frigate','destroyer']){
      src.army[t] = Math.max(0, (src.army[t]||0) - (composition[t]||0));
    }
    const travelMs = computeTravelTime(src, dst);
    const fleet = { id: nextFleetId++, from, to, owner: socket.id, composition, startTime: Date.now(), travelMs, progress:0, resolving:false, done:false };
    fleets.push(fleet);
    io.emit('state', { systems, fleets, players });
    cb && cb({ ok:true, fleetId: fleet.id });
  });

  socket.on('disconnect', () => {
    console.log('disconnect', socket.id);
    // optional: leave ownership as-is or release
    // for now we keep ownership so others can attack
  });
});

// start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server started on', PORT));
