const canvas = document.querySelector('canvas');
const c = canvas.getContext('2d');

const socket = io(); 

const DevicePixelRatio = window.devicePixelRatio || 1;

canvas.width = innerWidth * DevicePixelRatio;
canvas.height = innerHeight * DevicePixelRatio;
c.scale(DevicePixelRatio, DevicePixelRatio);

const FrontEndPlayers = {};
const FrontEndProjectiles = {};

socket.on('updateProjectiles', (BackEndProjectiles) => {
    for (const id in BackEndProjectiles) {
        const p = BackEndProjectiles[id];

        if (!FrontEndProjectiles[id]) {
            FrontEndProjectiles[id] = new Projectile({
                x: p.x,
                y: p.y,
                radius: 5,
                color: FrontEndPlayers[p.PlayerId]?.color || 'white',
                velocity: p.velocity
            });
        } else {
            FrontEndProjectiles[id].x = p.x;
            FrontEndProjectiles[id].y = p.y;
        }
    }

    for (const id in FrontEndProjectiles) {
        if (!BackEndProjectiles[id]) delete FrontEndProjectiles[id];
    }
});

socket.on('updatePlayers', (BackendPlayers) => {
    const parent = document.querySelector('#PlayerLabels');

    for (const id in BackendPlayers) {
        const bp = BackendPlayers[id];

        if (!FrontEndPlayers[id]) {
            FrontEndPlayers[id] = new Player({
                x: bp.x,
                y: bp.y,
                radius: bp.radius,
                color: bp.color
            });

            parent.innerHTML += `
        <div data-id="${id}" data-score="${bp.score}">
          ${bp.username}: ${bp.score}
        </div>
      `;
        }

        const label = parent.querySelector(`div[data-id="${id}"]`);
        if (label) {
            label.innerHTML = `${bp.username}: ${bp.score}`;
            label.setAttribute("data-score", bp.score);
        }

        const children = Array.from(parent.children);
        children.sort((a, b) => Number(b.dataset.score) - Number(a.dataset.score));
        parent.innerHTML = "";
        children.forEach(div => parent.appendChild(div));

        if (id === socket.id) {
            FrontEndPlayers[id].x = bp.x;
            FrontEndPlayers[id].y = bp.y;

            const lastIndex = playerInputs.findIndex(i => i.sequenceNumber === bp.sequenceNumber);
            if (lastIndex > -1) playerInputs.splice(0, lastIndex + 1);

            playerInputs.forEach(input => {
                FrontEndPlayers[id].x += input.dx;
                FrontEndPlayers[id].y += input.dy;
            });
        } else {
            gsap.to(FrontEndPlayers[id], {
                x: bp.x,
                y: bp.y,
                duration: 0.015,
                ease: 'linear'
            });
        }
    }

    for (const id in FrontEndPlayers) {
        if (!BackendPlayers[id]) {
            const div = parent.querySelector(`div[data-id="${id}"]`);
            if (div) div.remove();

            if (id === socket.id) {
                document.querySelector('#usernameForm').style.display = 'block';
            }

            delete FrontEndPlayers[id];
        }
    }
});

function animate() {
    requestAnimationFrame(animate);

    c.fillStyle = 'rgba(0, 0, 0, 0.1)';
    c.fillRect(0, 0, canvas.width, canvas.height);

    for (const id in FrontEndPlayers) {
        FrontEndPlayers[id].draw();
    }

    for (const id in FrontEndProjectiles) {
        FrontEndProjectiles[id].draw();
    }
}
animate();

const keys = { w: { pressed: false }, s: { pressed: false }, a: { pressed: false }, d: { pressed: false } };
const Speed = 6;
const playerInputs = [];
let sequenceNumber = 0;

setInterval(() => {
    const me = FrontEndPlayers[socket.id];
    if (!me) return;

    if (keys.w.pressed) {
        sequenceNumber++;
        playerInputs.push({ sequenceNumber, dx: 0, dy: -Speed });
        me.y -= Speed;
        socket.emit('move', { direction: 'up', sequenceNumber });
    }
    if (keys.s.pressed) {
        sequenceNumber++;
        playerInputs.push({ sequenceNumber, dx: 0, dy: Speed });
        me.y += Speed;
        socket.emit('move', { direction: 'down', sequenceNumber });
    }
    if (keys.a.pressed) {
        sequenceNumber++;
        playerInputs.push({ sequenceNumber, dx: -Speed, dy: 0 });
        me.x -= Speed;
        socket.emit('move', { direction: 'left', sequenceNumber });
    }
    if (keys.d.pressed) {
        sequenceNumber++;
        playerInputs.push({ sequenceNumber, dx: Speed, dy: 0 });
        me.x += Speed;
        socket.emit('move', { direction: 'right', sequenceNumber });
    }
}, 15);

window.addEventListener('keydown', (event) => {
    if (!FrontEndPlayers[socket.id]) return;

    switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
            keys.w.pressed = true;
            break;
        case 'KeyA':
        case 'ArrowLeft':
            keys.a.pressed = true;
            break;
        case 'KeyS':
        case 'ArrowDown':
            keys.s.pressed = true;
            break;
        case 'KeyD':
        case 'ArrowRight':
            keys.d.pressed = true;
            break;
    }
});

window.addEventListener('keyup', (event) => {
    switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
            keys.w.pressed = false;
            break;
        case 'KeyA':
        case 'ArrowLeft':
            keys.a.pressed = false;
            break;
        case 'KeyS':
        case 'ArrowDown':
            keys.s.pressed = false;
            break;
        case 'KeyD':
        case 'ArrowRight':
            keys.d.pressed = false;
            break;
    }
});

document.querySelector('#usernameForm').addEventListener('submit', (event) => {
    event.preventDefault();
    document.querySelector('#usernameForm').style.display = 'none';

    socket.emit('initGame', {
        username: document.querySelector('#UsernameInput').value,
        width: canvas.width,
        height: canvas.height,
        devicePixelRatio: DevicePixelRatio
    });
});