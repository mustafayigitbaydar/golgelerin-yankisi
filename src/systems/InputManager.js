import * as THREE from 'three';

export class InputManager {
  constructor(domElement) {
    this.keys = { w: false, a: false, s: false, d: false };
    this.spacePressed = false;
    this.spaceDown = false;

    // Weapon select keys
    this.weapon1Pressed = false;
    this.weapon2Pressed = false;
    this.weapon3Pressed = false;

    // Mouse buttons
    this.mouseLeftPressed = false;
    this.mouseLeftDown = false;
    this.mouseRightPressed = false;
    this.mouseRightDown = false;

    this.mouseNDC = new THREE.Vector2();
    this.mouseWorldPos = new THREE.Vector3(0, 0, 1);
    this._raycaster = new THREE.Raycaster();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    const keyMap = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd' };

    window.addEventListener('keydown', (e) => {
      const m = keyMap[e.code];
      if (m) this.keys[m] = true;

      if (e.code === 'Space') {
        if (!this.spaceDown) this.spacePressed = true;
        this.spaceDown = true;
        e.preventDefault();
      }

      if (e.code === 'Digit1' || e.code === 'Numpad1') {
        this.weapon1Pressed = true;
        e.preventDefault();
      }
      if (e.code === 'Digit2' || e.code === 'Numpad2') {
        this.weapon2Pressed = true;
        e.preventDefault();
      }
      if (e.code === 'Digit3' || e.code === 'Numpad3') {
        this.weapon3Pressed = true;
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      const m = keyMap[e.code];
      if (m) this.keys[m] = false;
      if (e.code === 'Space') this.spaceDown = false;
    });

    domElement.addEventListener('mousemove', (e) => {
      this.mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    domElement.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseLeftPressed = true;
        this.mouseLeftDown = true;
      } else if (e.button === 2) {
        this.mouseRightPressed = true;
        this.mouseRightDown = true;
      }
    });

    domElement.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseLeftDown = false;
      if (e.button === 2) this.mouseRightDown = false;
    });

    domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  update(camera) {
    this._raycaster.setFromCamera(this.mouseNDC, camera);
    this._raycaster.ray.intersectPlane(this._groundPlane, this.mouseWorldPos);
  }

  resetFrame() {
    this.mouseLeftPressed = false;
    this.mouseRightPressed = false;
    this.spacePressed = false;
    this.weapon1Pressed = false;
    this.weapon2Pressed = false;
    this.weapon3Pressed = false;
  }
}
