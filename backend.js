const express = require('express'); const path = require('path');
const express = require('express');
const app = express();

const { createServer } = require('node:http');
const server = createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
    pingInterval: 1000,
    pingTimeout: 5000
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const BackEndPlayers = {};
const BackEndProjectiles = {};

const Speed = 6;
const Radius = 18;
const ProjectRadius = 5;
let ProjectileId = 0;

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.emit('updatePlayers', BackEndPlayers);

    socket.on('shoot', ({ x, y, angle }) => {
        ProjectileId++;

        const velocity = {
            x: Math.cos(angle) * 5,
            y: Math.sin(angle) * 5
        };

        BackEndProjectiles[ProjectileId] = {
            x,
            y,
            velocity,
            PlayerId: socket.id
        };
    });

    socket.on('initGame', ({ username, width, height, devicePixelRatio }) => {
        BackEndPlayers[socket.id] = {
            x: 1000 * Math.random(),
            y: 800 * Math.random(),
            color: `hsl(${360 * Math.random()}, 100%, 50%)`,
            sequenceNumber: 0,
            score: 0,
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

        switch (direction) {
            case 'up': player.y -= Speed; break;
            case 'down': player.y += Speed; break;
            case 'left': player.x -= Speed; break;
            case 'right': player.x += Speed; break;
        }
    });
});

setInterval(() => {
    for (const id in BackEndProjectiles) {
        const proj = BackEndProjectiles[id];
        proj.x += proj.velocity.x;
        proj.y += proj.velocity.y;

        const ownerCanvas = BackEndPlayers[proj.PlayerId]?.canvas;

        if (!ownerCanvas ||
            proj.x - ProjectRadius >= ownerCanvas.width ||
            proj.x + ProjectRadius <= 0 ||
            proj.y - ProjectRadius >= ownerCanvas.height ||
            proj.y + ProjectRadius <= 0) {
            delete BackEndProjectiles[id];
            continue;
        }

        for (const PlayerId in BackEndPlayers) {
            const player = BackEndPlayers[PlayerId];

            const dist = Math.hypot(
                proj.x - player.x,
                proj.y - player.y
            );

            if (dist < ProjectRadius + player.radius &&
                proj.PlayerId !== PlayerId) {

                if (BackEndPlayers[proj.PlayerId])
                    BackEndPlayers[proj.PlayerId].score++;

                delete BackEndProjectiles[id];
                delete BackEndPlayers[PlayerId];
                break;
            }
        }
    }

    io.emit('updateProjectiles', BackEndProjectiles);
    io.emit('updatePlayers', BackEndPlayers);
}, 15);

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});