// server.js — Soso Galaxy Conquest V6
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');


const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });


const CANVAS_W = 1600;
const CANVAS_H = 900;
const NUM_PLANETS = 28;
const FLEET_SPEED = 160; // pixels per sec
const TICK_MS = 500; // server tick


let planets = [];
let fleets = [];
let nextFleetId = 1;


const UNIT_TYPES = {
fighter: { name: 'Chasseur', hp: 10, atk: 3, cost: { metal: 20, energy: 5 }, cargo: 0, speed: 2.0 },
frigate: { name: 'Frégate', hp: 28, atk: 9, cost: { metal: 60, energy: 20 }, cargo: 0, speed: 1.6 },
destroyer: { name: 'Destroyer', hp: 90, atk: 26, cost: { metal: 180, energy: 60 }, cargo: 0, speed: 1.1 },
cruiser: { name: 'Cuirassé', hp: 200, atk: 55, cost: { metal: 420, energy: 150 }, cargo: 0, speed: 0.8 },
transport: { name: 'Transporteur',hp: 40, atk: 2, cost: { metal: 50, energy: 20 }, cargo: 500, speed: 1.2 }
};


function randRange(a,b){return a+Math.random()*(b-a)}


function generateGalaxy(){
planets = [];
planets.push({
id:0, name:'Terre', x:CANVAS_W/2, y:CANVAS_H/2, owner:null, isHome:true,
resources:{metal:2500, energy:1800}, buildings:{mine:5,power:5,lab:3,shipyard:2}, research:{spaceTravel:true},
army: { fighter:120, frigate:20, destroyer:5, cruiser:1, transport:3 }, armyTotal:0, armyPower:0, armyHp:0, armyCargo:0,
armyCompute: function(){ let tot=0,pow=0,hp=0,cargo=0; for(let t in this.army){ tot += this.army[t]; pow += (UNIT_TYPES[t].atk||0)*this.army[t]; hp += (UNIT_TYPES[t].hp||0)*this.army[t]; cargo += (UNIT_TYPES[t].cargo||0)*this.army[t]; } this.armyTotal=tot; this.armyPower=pow; this.armyHp=hp; this.armyCargo=cargo; }
});


function overlapped(x,y){ return planets.some(p=>Math.hypot(p.x-x,p.y-y) < 110); }


for(let i=1;i<NUM_PLANETS;i++){
let x,y,tries=0; do{ x = randRange(120,CANVAS_W-120); y = randRange(80,CANVAS_H-80); tries++; if(tries>300) break;}while(overlapped(x,y));
const owner = Math.random() < 0.08 ? null : 'neutre';
const p = {
id:i, name:`Système ${i}`, x,y, owner, isHome:false,
resources:{metal: Math.floor(300 + Math.random()*1700), energy: Math.floor(200 + Math.random()*1100)},
buildings:{mine:1+Math.floor(Math.random()*3), power:1+Math.floor(Math.random()*2), lab:0, shipyard:0}, research:{spaceTravel:false},
army:{fighter: Math.floor(10+Math.random()*60), frigate: Math.floor(Math.random()*6), destroyer: Math.floor(Math.random()*2), cruiser:0, transport:0}
};
p.armyTotal=0; p.armyPower=0; p.armyHp=0; p.armyCargo=0; p.armyCompute = function(){ let tot=0,pow=0,hp=0,cargo=0; for(let t in this.army){ tot += this.army[t]; pow += (UNIT_TYPES[t].atk||0)*this.army[t]; hp += (UNIT_TYPES[t].hp||0)*this.army[t]; cargo += (UNIT_TYPES[t].cargo||0)*this.army[t]; } this.armyTotal=tot; this.armyPower=pow; this.armyHp=hp; this.armyCargo=cargo; };
p.armyCompute();
planets.push(p);
}
planets.forEach(p=>p.armyCompute && p.armyCompute());
const elap
