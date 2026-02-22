const path = require('path');
const express = require('express');
const app = express();
const { createServer } = require('node:http');
const server = createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, { pingInterval: 1000, pingTimeout: 5000 });

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const BackEndPlayers = {};
const BackEndProjectiles = {};

const Blocks = [
  { x: 0, y: 0, width: 1600, height: 40 },
  { x: 0, y: 860, width: 1600, height: 40 },
  { x: 0, y: 0, width: 40, height: 900 },
  { x: 1560, y: 0, width: 40, height: 900 },

  { x: 80, y: 80, width: 260, height: 80 },
  { x: 80, y: 720, width: 260, height: 80 },
  { x: 1260, y: 80, width: 260, height: 80 },
  { x: 1260, y: 720, width: 260, height: 80 },

  { x: 80, y: 200, width: 80, height: 260 },
  { x: 260, y: 200, width: 80, height: 260 },
  { x: 1260, y: 200, width: 80, height: 260 },
  { x: 1440, y: 200, width: 80, height: 260 },

  { x: 80, y: 440, width: 260, height: 80 },
  { x: 1260, y: 440, width: 260, height: 80 },

  { x: 80, y: 520, width: 80, height: 260 },
  { x: 260, y: 520, width: 80, height: 260 },
  { x: 1260, y: 520, width: 80, height: 260 },
  { x: 1440, y: 520, width: 80, height: 260 },

  { x: 520, y: 200, width: 560, height: 80 },
  { x: 520, y: 620, width: 560, height: 80 },

  { x: 520, y: 280, width: 80, height: 260 },
  { x: 1000, y: 280, width: 80, height: 260 }
];

const Speed = 6;
const Radius = 18;
const ProjectRadius = 5;
let ProjectileId = 0;

let HealthPickup = null;
const HealthPickupRadius = 14;
const HealthRespawnTime = 8000;

function circleRectCollide(cx, cy, r, rect) {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}

function spawnHealthPickup() {
  const minX = 80;
  const maxX = 1520;
  const minY = 80;
  const maxY = 820;
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * (maxX - minX) + minX;
    const y = Math.random() * (maxY - minY) + minY;
    let collides = false;
    for (const block of Blocks) {
      if (circleRectCollide(x, y, HealthPickupRadius + 4, block)) {
        collides = true;
        break;
      }
    }
    if (!collides) {
      HealthPickup = { x, y, radius: HealthPickupRadius };
      return;
    }
  }
  HealthPickup = null;
}

setInterval(() => {
  if (!HealthPickup) spawnHealthPickup();
}, HealthRespawnTime);

io.on('connection', socket => {
  socket.emit('initBlocks', Blocks);
  if (HealthPickup) socket.emit('updateHealthPickup', HealthPickup);
  socket.emit('updatePlayers', BackEndPlayers);

  socket.on('shoot', ({ x, y, angle }) => {
    ProjectileId++;
    const velocity = { x: Math.cos(angle) * 5, y: Math.sin(angle) * 5 };
    BackEndProjectiles[ProjectileId] = { x, y, velocity, PlayerId: socket.id };
  });

  socket.on('initGame', ({ username, width, height, devicePixelRatio }) => {
    BackEndPlayers[socket.id] = {
      x: 800,
      y: 450,
      color: `hsl(${360 * Math.random()}, 100%, 50%)`,
      sequenceNumber: 0,
      score: 0,
      hp: 3,
      username,
      canvas: { width, height },
      radius: devicePixelRatio > 1 ? Radius * 2 : Radius
    };
    io.emit('updatePlayers', BackEndPlayers);
  });

  socket.on('disconnect', () => {
    delete BackEndPlayers[socket.id];
    io.emit('updatePlayers', BackEndPlayers);
  });

  socket.on('move', ({ direction, sequenceNumber }) => {
    const player = BackEndPlayers[socket.id];
    if (!player) return;
    player.sequenceNumber = sequenceNumber;

    const oldX = player.x;
    const oldY = player.y;

    if (direction === 'up') player.y -= Speed;
    else if (direction === 'down') player.y += Speed;
    else if (direction === 'left') player.x -= Speed;
    else if (direction === 'right') player.x += Speed;

    for (const block of Blocks) {
      if (circleRectCollide(player.x, player.y, player.radius, block)) {
        player.x = oldX;
        player.y = oldY;
        break;
      }
    }

    if (HealthPickup) {
      const dist = Math.hypot(player.x - HealthPickup.x, player.y - HealthPickup.y);
      if (dist < player.radius + HealthPickup.radius) {
        player.hp = Math.min(player.hp + 1, 5);
        HealthPickup = null;
        io.emit('updateHealthPickup', null);
      }
    }
  });
});

setInterval(() => {
  for (const id in BackEndProjectiles) {
    const proj = BackEndProjectiles[id];
    proj.x += proj.velocity.x;
    proj.y += proj.velocity.y;

    let hitBlock = false;
    for (const block of Blocks) {
      if (circleRectCollide(proj.x, proj.y, ProjectRadius, block)) {
        hitBlock = true;
        break;
      }
    }
    if (hitBlock) {
      delete BackEndProjectiles[id];
      continue;
    }

    const ownerCanvas = BackEndPlayers[proj.PlayerId]?.canvas;
    if (
      !ownerCanvas ||
      proj.x - ProjectRadius >= ownerCanvas.width ||
      proj.x + ProjectRadius <= 0 ||
      proj.y - ProjectRadius >= ownerCanvas.height ||
      proj.y + ProjectRadius <= 0
    ) {
      delete BackEndProjectiles[id];
      continue;
    }

    for (const PlayerId in BackEndPlayers) {
      const player = BackEndPlayers[PlayerId];
      const dist = Math.hypot(proj.x - player.x, proj.y - player.y);
      if (dist < ProjectRadius + player.radius && proj.PlayerId !== PlayerId) {
        player.hp -= 1;
        if (BackEndPlayers[proj.PlayerId]) BackEndPlayers[proj.PlayerId].score++;
        delete BackEndProjectiles[id];
        if (player.hp <= 0) delete BackEndPlayers[PlayerId];
        break;
      }
    }
  }

  if (HealthPickup && Object.keys(BackEndPlayers).length > 0) {
    io.emit('updateHealthPickup', HealthPickup);
  }

  io.emit('updateProjectiles', BackEndProjectiles);
  io.emit('updatePlayers', BackEndPlayers);
}, 15);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

