import * as THREE from 'three';

export class InputManager {
  constructor(domElement) {
    this.keys = { w: false, a: false, s: false, d: false };
    this.moveVec = { x: 0, z: 0 };
    this.spacePressed = false;
    this.spaceDown = false;

    // Weapon select keys
    this.weapon1Pressed = false;
    this.weapon2Pressed = false;
    this.weapon3Pressed = false;

    // Mouse / Touch action buttons
    this.mouseLeftPressed = false;
    this.mouseLeftDown = false;
    this.mouseRightPressed = false;
    this.mouseRightDown = false;

    // Touch mode auto-detection (coarse pointer = phone/tablet)
    this.isTouchActive =
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
      'ontouchstart' in window;
    if (this.isTouchActive) {
      document.body.classList.add('touch-mode');
    }

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

    // Switch seamlessly if user uses a real mouse on a hybrid device
    domElement.addEventListener('mousemove', (e) => {
      if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
      this.mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    domElement.addEventListener('mousedown', (e) => {
      if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
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

    // Activate touch UI on first touch anywhere
    window.addEventListener(
      'touchstart',
      () => {
        if (!this.isTouchActive) {
          this.isTouchActive = true;
          document.body.classList.add('touch-mode');
        }
      },
      { passive: true },
    );

    this._bindTouchControls();
  }

  _bindTouchControls() {
    const joyBase = document.getElementById('touch-joystick');
    const joyStick = document.getElementById('touch-stick');
    this._joyStickEl = joyStick;
    this._joyTouchId = null;

    if (joyBase && joyStick) {
      const maxDist = 42;

      const updateStick = (touch) => {
        const rect = joyBase.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = touch.clientX - cx;
        let dy = touch.clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > maxDist) {
          dx = (dx / dist) * maxDist;
          dy = (dy / dist) * maxDist;
        }
        joyStick.style.transform = `translate(${dx}px, ${dy}px)`;
        const deadzone = 0.14;
        const nx = dx / maxDist;
        const ny = dy / maxDist;
        this.moveVec.x = Math.abs(nx) < deadzone ? 0 : nx;
        this.moveVec.z = Math.abs(ny) < deadzone ? 0 : ny;
      };

      const resetStick = () => {
        this._joyTouchId = null;
        this.moveVec.x = 0;
        this.moveVec.z = 0;
        joyStick.style.transform = 'translate(0px, 0px)';
      };

      joyBase.addEventListener(
        'touchstart',
        (e) => {
          e.preventDefault();
          if (this._joyTouchId !== null) return;
          const t = e.changedTouches[0];
          this._joyTouchId = t.identifier;
          updateStick(t);
        },
        { passive: false },
      );

      joyBase.addEventListener(
        'touchmove',
        (e) => {
          e.preventDefault();
          for (const t of e.changedTouches) {
            if (t.identifier === this._joyTouchId) {
              updateStick(t);
              break;
            }
          }
        },
        { passive: false },
      );

      const onEnd = (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === this._joyTouchId) {
            resetStick();
            break;
          }
        }
      };
      joyBase.addEventListener('touchend', onEnd, { passive: true });
      joyBase.addEventListener('touchcancel', onEnd, { passive: true });
    }

    const bindBtn = (id, onDown, onUp) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener(
        'touchstart',
        (e) => {
          e.preventDefault();
          btn.classList.add('pressed');
          onDown();
        },
        { passive: false },
      );
      const end = (e) => {
        e.preventDefault();
        btn.classList.remove('pressed');
        if (onUp) onUp();
      };
      btn.addEventListener('touchend', end, { passive: false });
      btn.addEventListener('touchcancel', end, { passive: false });
    };

    bindBtn(
      'btn-touch-attack',
      () => {
        this.mouseLeftPressed = true;
        this.mouseLeftDown = true;
      },
      () => {
        this.mouseLeftDown = false;
      },
    );

    bindBtn(
      'btn-touch-special',
      () => {
        this.mouseRightPressed = true;
        this.mouseRightDown = true;
      },
      () => {
        this.mouseRightDown = false;
      },
    );

    bindBtn(
      'btn-touch-dash',
      () => {
        if (!this.spaceDown) this.spacePressed = true;
        this.spaceDown = true;
      },
      () => {
        this.spaceDown = false;
      },
    );
  }

  clearTouchState() {
    this._joyTouchId = null;
    this.moveVec.x = 0;
    this.moveVec.z = 0;
    if (this._joyStickEl) {
      this._joyStickEl.style.transform = 'translate(0px, 0px)';
    }
    ['btn-touch-attack', 'btn-touch-special', 'btn-touch-dash'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('pressed');
    });
  }

  setAutoAimTarget(pos) {
    if (pos) this.mouseWorldPos.copy(pos);
  }

  update(camera) {
    if (!this.isTouchActive) {
      this._raycaster.setFromCamera(this.mouseNDC, camera);
      this._raycaster.ray.intersectPlane(this._groundPlane, this.mouseWorldPos);
    }
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
