const canvas = document.querySelector('canvas');
const c = canvas.getContext('2d');

const SERVER_URL = window.location.origin;
document.querySelector('#serverIpDisplay').innerText = 'Server: ' + SERVER_URL;

const socket = io(SERVER_URL);

socket.on('connect', () => {
  document.querySelector('#connectionMenu').style.display = 'none';
});

document.querySelector('#hostBtn').onclick = () => {
  window.location.reload();
};

const DevicePixelRatio = window.devicePixelRatio || 1;
canvas.width = 1600 * DevicePixelRatio;
canvas.height = 900 * DevicePixelRatio;
c.scale(DevicePixelRatio, DevicePixelRatio);

const FrontEndPlayers = {};
const FrontEndProjectiles = {};
const FrontEndBlocks = [];
let FrontEndHealthPickup = null;

function circleRectCollide(cx, cy, r, rect) {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}

socket.on('initBlocks', blocks => {
  FrontEndBlocks.length = 0;
  blocks.forEach(b => {
    FrontEndBlocks.push(
      new Block({
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height
      })
    );
  });
});

socket.on('updateHealthPickup', hp => {
  if (!hp) {
    FrontEndHealthPickup = null;
    return;
  }
  FrontEndHealthPickup = new HealthPickup({
    x: hp.x,
    y: hp.y,
    radius: hp.radius
  });
});

socket.on('updateProjectiles', BackEndProjectiles => {
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

socket.on('updatePlayers', BackendPlayers => {
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
      parent.innerHTML += `<div data-id="${id}" data-score="${bp.score}">${bp.username} [HP:${bp.hp}]: ${bp.score}</div>`;
    }
    const label = parent.querySelector(`div[data-id="${id}"]`);
    if (label) {
      label.innerHTML = `${bp.username} [HP:${bp.hp}]: ${bp.score}`;
      label.setAttribute('data-score', bp.score);
    }
    const children = Array.from(parent.children);
    children.sort((a, b) => Number(b.dataset.score) - Number(a.dataset.score));
    parent.innerHTML = '';
    children.forEach(div => parent.appendChild(div));
    if (id === socket.id) {
      FrontEndPlayers[id].x = bp.x;
      FrontEndPlayers[id].y = bp.y;
      const lastIndex = playerInputs.findIndex(i => i.sequenceNumber === bp.sequenceNumber);
      if (lastIndex > -1) playerInputs.splice(0, lastIndex + 1);
      playerInputs.forEach(input => {
        const oldX = FrontEndPlayers[id].x;
        const oldY = FrontEndPlayers[id].y;
        FrontEndPlayers[id].x += input.dx;
        FrontEndPlayers[id].y += input.dy;
        for (const block of FrontEndBlocks) {
          if (circleRectCollide(FrontEndPlayers[id].x, FrontEndPlayers[id].y, FrontEndPlayers[id].radius, block)) {
            FrontEndPlayers[id].x = oldX;
            FrontEndPlayers[id].y = oldY;
            break;
          }
        }
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

  FrontEndBlocks.forEach(block => block.draw(c));

  if (FrontEndHealthPickup) FrontEndHealthPickup.draw(c);

  for (const id in FrontEndPlayers) {
    FrontEndPlayers[id].draw();
  }
  for (const id in FrontEndProjectiles) {
    FrontEndProjectiles[id].draw();
  }
}
animate();

const keys = {
  w: { pressed: false },
  s: { pressed: false },
  a: { pressed: false },
  d: { pressed: false }
};

const Speed = 6;
const playerInputs = [];
let sequenceNumber = 0;

setInterval(() => {
  const me = FrontEndPlayers[socket.id];
  if (!me) return;

  if (keys.w.pressed) {
    sequenceNumber++;
    const dx = 0;
    const dy = -Speed;
    const oldX = me.x;
    const oldY = me.y;
    me.y += dy;
    let blocked = false;
    for (const block of FrontEndBlocks) {
      if (circleRectCollide(me.x, me.y, me.radius, block)) {
        blocked = true;
        break;
      }
    }
    if (blocked) {
      me.x = oldX;
      me.y = oldY;
    } else {
      playerInputs.push({ sequenceNumber, dx, dy });
      socket.emit('move', { direction: 'up', sequenceNumber });
    }
  }
  if (keys.s.pressed) {
    sequenceNumber++;
    const dx = 0;
    const dy = Speed;
    const oldX = me.x;
    const oldY = me.y;
    me.y += dy;
    let blocked = false;
    for (const block of FrontEndBlocks) {
      if (circleRectCollide(me.x, me.y, me.radius, block)) {
        blocked = true;
        break;
      }
    }
    if (blocked) {
      me.x = oldX;
      me.y = oldY;
    } else {
      playerInputs.push({ sequenceNumber, dx, dy });
      socket.emit('move', { direction: 'down', sequenceNumber });
    }
  }
  if (keys.a.pressed) {
    sequenceNumber++;
    const dx = -Speed;
    const dy = 0;
    const oldX = me.x;
    const oldY = me.y;
    me.x += dx;
    let blocked = false;
    for (const block of FrontEndBlocks) {
      if (circleRectCollide(me.x, me.y, me.radius, block)) {
        blocked = true;
        break;
      }
    }
    if (blocked) {
      me.x = oldX;
      me.y = oldY;
    } else {
      playerInputs.push({ sequenceNumber, dx, dy });
      socket.emit('move', { direction: 'left', sequenceNumber });
    }
  }
  if (keys.d.pressed) {
    sequenceNumber++;
    const dx = Speed;
    const dy = 0;
    const oldX = me.x;
    const oldY = me.y;
    me.x += dx;
    let blocked = false;
    for (const block of FrontEndBlocks) {
      if (circleRectCollide(me.x, me.y, me.radius, block)) {
        blocked = true;
        break;
      }
    }
    if (blocked) {
      me.x = oldX;
      me.y = oldY;
    } else {
      playerInputs.push({ sequenceNumber, dx, dy });
      socket.emit('move', { direction: 'right', sequenceNumber });
    }
  }
}, 15);

window.addEventListener('keydown', event => {
  if (!FrontEndPlayers[socket.id]) return;
  if (event.code === 'KeyW' || event.code === 'ArrowUp') keys.w.pressed = true;
  else if (event.code === 'KeyS' || event.code === 'ArrowDown') keys.s.pressed = true;
  else if (event.code === 'KeyA' || event.code === 'ArrowLeft') keys.a.pressed = true;
  else if (event.code === 'KeyD' || event.code === 'ArrowRight') keys.d.pressed = true;
});

window.addEventListener('keyup', event => {
  if (event.code === 'KeyW' || event.code === 'ArrowUp') keys.w.pressed = false;
  else if (event.code === 'KeyS' || event.code === 'ArrowDown') keys.s.pressed = false;
  else if (event.code === 'KeyA' || event.code === 'ArrowLeft') keys.a.pressed = false;
  else if (event.code === 'KeyD' || event.code === 'ArrowRight') keys.d.pressed = false;
});

document.querySelector('#usernameForm').addEventListener('submit', event => {
  event.preventDefault();
  document.querySelector('#usernameForm').style.display = 'none';
  socket.emit('initGame', {
    username: document.querySelector('#UsernameInput').value,
    width: canvas.width,
    height: canvas.height,
    devicePixelRatio: DevicePixelRatio
  });
});

