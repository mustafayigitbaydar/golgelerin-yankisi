import * as THREE from 'three';

const FRUSTUM_SIZE = 14;
const ISO_DISTANCE = 20;
const ISO_OFFSET = new THREE.Vector3(ISO_DISTANCE, ISO_DISTANCE, ISO_DISTANCE);

export function createCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  const camera = new THREE.OrthographicCamera(
    -FRUSTUM_SIZE * aspect / 2,
     FRUSTUM_SIZE * aspect / 2,
     FRUSTUM_SIZE / 2,
    -FRUSTUM_SIZE / 2,
    0.1,
    100,
  );

  camera.position.copy(ISO_OFFSET);
  camera.lookAt(0, 0, 0);

  window.addEventListener('resize', () => {
    const a = window.innerWidth / window.innerHeight;
    camera.left   = -FRUSTUM_SIZE * a / 2;
    camera.right  =  FRUSTUM_SIZE * a / 2;
    camera.top    =  FRUSTUM_SIZE / 2;
    camera.bottom = -FRUSTUM_SIZE / 2;
    camera.updateProjectionMatrix();
  });

  return camera;
}

const _target = new THREE.Vector3();

export function updateCamera(camera, playerPos, dt) {
  _target.copy(playerPos).add(ISO_OFFSET);
  camera.position.lerp(_target, 1 - Math.exp(-8 * dt));
  camera.lookAt(playerPos);
}
