addEventListener('click', (event) => {

    const playerPosition = {
        x: FrontEndPlayers[socket.id].x,
        y: FrontEndPlayers[socket.id].y
    }
    const angle = Math.atan2(
        (event.clientY * window.devicePixelRatio) - playerPosition.y,
        (event.clientX * window.devicePixelRatio) - playerPosition.x
  )
  

    socket.emit('shoot', {
        x: playerPosition.x,
        y: playerPosition.y,
        angle

    })

    console.log(FrontEndProjectiles)
})
