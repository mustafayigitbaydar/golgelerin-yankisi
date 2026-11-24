export class GameLoop {
  constructor(tickFn) {
    this.tickFn = tickFn;
    this.lastTime = 0;
    this.running = false;
    this._tick = this._tick.bind(this);
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this._tick);
  }

  _tick(time) {
    if (!this.running) return;
    requestAnimationFrame(this._tick);

    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;
    this.tickFn(dt);
  }

  stop() {
    this.running = false;
  }
}
