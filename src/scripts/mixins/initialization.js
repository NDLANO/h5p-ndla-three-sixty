import {
  CAMERA_NEAR, CAMERA_FAR, DEFAULT_FRICTION, DEFAULT_ROTATION_ORDER, MAX_PITCH
} from '@services/constants';
import PositionControls from '@scripts/position-controls';
import ZoomControls from '@scripts/zoom-controls';
import Util from '@services/util';

/**
 * Mixin containing methods for initialization.
 */
export default class Initialization {
  /**
   * Build camera.
   * @param {object} [startPosition] Startposition.
   */
  buildCamera(startPosition = {}) {
    this.camera = new H5P.ThreeJS.PerspectiveCamera(
      this.fieldOfView,
      this.options.ratio,
      CAMERA_NEAR,
      CAMERA_FAR
    );
    this.camera.rotation.order = DEFAULT_ROTATION_ORDER;

    this.setCameraPosition(
      startPosition.yaw ?? -(Math.PI * (2 / 3)),
      startPosition.pitch ?? 0
    );
  }

  /**
   * Build renderers.
   */
  buildRenderers() {
    this.renderer = new H5P.ThreeJS.WebGLRenderer();
    this.renderer.domElement.classList.add('h5p-three-sixty-scene');
    // Workaround for touchevent not cancelable when CSS 'perspective' is set.
    this.renderer.domElement.addEventListener('touchmove', () => {});
    // This appears to be a bug in Chrome.
    this.element.append(this.renderer.domElement);

    this.css2dRenderer = new H5P.ThreeJS.CSS2DRenderer();
    this.css2dRenderer.domElement.classList.add(
      'h5p-three-sixty-scene', 'h5p-three-sixty-2d', 'h5p-three-sixty-controls'
    );
    this.element.append(this.css2dRenderer.domElement);

    this.css3dRenderer = new H5P.ThreeJS.CSS3DRenderer();
    this.css3dRenderer.domElement.classList.add(
      'h5p-three-sixty-scene', 'h5p-three-sixty-3d', 'h5p-three-sixty-controls'
    );
    this.element.append(this.css3dRenderer.domElement);
  }

  /**
   * Add camera controls.
   */
  buildCameraControls() {
    this.cameraControls = new PositionControls(
      this.css2dRenderer.domElement,
      this.camera,
      {
        friction: DEFAULT_FRICTION,
        invert: true,
        isCamera: true,
        isPanorama: this.options.isPanorama
      }
    );

    // Camera starts moving handler
    this.cameraControls.on('movestart', (event) => {
      // Set camera start position
      this.cameraControls.startY = this.camera.rotation.y;
      this.cameraControls.startX = this.camera.rotation.x;

      this.preventDeviceOrientation = true;

      // Relay event
      this.trigger(event);
    });

    // Rotate camera as controls move
    this.cameraControls.on('move', (event) => {
      let yaw = this.cameraControls.startY + event.alpha;
      let pitch = this.cameraControls.startX + event.beta;

      // Set outer bounds for camera so it does not loop around.
      // It can max see max 90 degrees up and down
      const radsFromCameraCenter = Util.toRad(this.fieldOfView) / 2;

      if (this.options.isPanorama) {
        // Base max pitch on field of view
        const MAX_PITCH_PANORAMA = (Util.toRad(this.fieldOfView) - Util.toRad(this.camera.fov)) / 2;
        const maxPitch = Math.min(MAX_PITCH_PANORAMA, MAX_PITCH);

        if (pitch > maxPitch) {
          pitch = maxPitch;
        }
        else if (pitch < -maxPitch) {
          pitch = -maxPitch;
        }
      }
      else {
        // Keep pitch between -90 and 90 degrees
        if (pitch + radsFromCameraCenter > MAX_PITCH) {
          pitch = MAX_PITCH - radsFromCameraCenter;
        }
        else if (pitch - radsFromCameraCenter < -MAX_PITCH) {
          pitch = -MAX_PITCH + radsFromCameraCenter;
        }
      }

      // Keep yaw between 0 and 2PI
      yaw %= Math.PI * 2;
      if (yaw < 0) { // Reset when passing 0
        yaw += Math.PI * 2;
      }

      // Allow infinite yaw rotations
      this.camera.rotation.y = yaw;
      this.camera.rotation.x = pitch;
    });

    // Relay camera movement stopped event
    this.cameraControls.on('movestop', (event) => {
      this.preventDeviceOrientation = false;

      event.data = {
        yaw: -this.camera.rotation.y,
        pitch: this.camera.rotation.x
      };

      this.trigger(event);
    });
  }

  /**
   * Add zoom controls.
   */
  buildZoomControls() {
    this.zoomControls = new ZoomControls(
      this.camera, 
      this.css2dRenderer.domElement,
      this.options.isPanorama,
      this.options.enableZoom
    );

    // Make sure we don't see the black background when zooming out in panorama,
    // by using cameraControls move to adjust the view.
    this.zoomControls.on('zoomout', () => {
      if (!this.cameraControls || !this.options.isPanorama) {
        return;
      }
        
      this.cameraControls.start();
      this.cameraControls.move(0, 0, DEFAULT_FRICTION);
      this.cameraControls.end();
    });
  }
}
