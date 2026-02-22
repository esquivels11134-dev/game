class HealthPickup {
  constructor({ x, y, radius = 14, color = '#22c55e' }) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = color;
  }

  draw(c) {
    c.beginPath();
    c.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    c.fillStyle = this.color;
    c.fill();
    c.closePath();

    c.strokeStyle = '#bbf7d0';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(this.x - this.radius / 2, this.y);
    c.lineTo(this.x + this.radius / 2, this.y);
    c.moveTo(this.x, this.y - this.radius / 2);
    c.lineTo(this.x, this.y + this.radius / 2);
    c.stroke();
    c.closePath();
  }
}
