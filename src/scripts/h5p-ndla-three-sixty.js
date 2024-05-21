import {
  DEFAULT_RATIO, DEFAULT_ROTATION_ORDER, FOV_PANORAMA, FOV_SPHERE
} from '@services/constants';

import PositionControls from '@scripts/position-controls';
import Util from '@services/util';
import Initialization from '@mixins/initialization';
import SphereHandling from '@mixins/sphere-handling';

export default class NDLAThreeSixty extends H5P.EventDispatcher {

  /**
   * The 360 degree panorama viewer with support for virtual reality.
   * @class H5P.NDLAThreeSixty
   * @augments H5P.EventDispatcher
   * @param {HTMLElement} sourceElement Video or image source.
   * @param {object} options Options.
   * @param {number} options.ratio Display ratio of the viewport
   * @param {object} options.cameraStartPosition Start position.
   * @param {number} options.cameraStartPosition.yaw 0 = Center of image.
   * @param {number} options.cameraStartPosition.pitch 0 = Center of image.
   * @param {number} options.segments Number of segments.
   * @param {boolean} options.isPanorama If true, scene is panorama scene.
   * @param {boolean} options.enableZoom If true, enable zoom.
   */
  constructor(sourceElement, options) {
    super();

    Util.addMixins(
      NDLAThreeSixty, [Initialization, SphereHandling]
    );

    this.options = Util.extend({
      cameraStartPosition: { pitch: 0, yaw: 0 },
      ratio: DEFAULT_RATIO,
      segments: 4,
      isPanorama: false,
      enableZoom: true
    }, options);

    this.sourceElement = sourceElement;

    this.fieldOfView = options.isPanorama ? FOV_PANORAMA : FOV_SPHERE;

    /*
     * // TODO: ThreeSixty should not have to deal with this, this belongs in a
     * a separate collection/array class. (ThreeSixty should just add or remove
     * elements from the 3d world, not keep an indexed mapping for the
     * consumer/user of this library.). Originally added by H5P Group. True, but
     * not urgent now.
     */
    this.threeElements = [];
    this.preventCameraMovement = false;
    this.renderLoopId = null;

    // Main wrapper element
    this.element = document.createElement('div');
    this.element.classList.add('h5p-three-sixty');

    // Create scene, add camera and a WebGL renderer
    this.scene = new H5P.ThreeJS.Scene();

    // Create a scene for our "CSS world"
    this.cssScene = new H5P.ThreeJS.Scene();

    this.buildCamera(options.cameraStartPosition);
    this.buildRenderers();
    this.buildCameraControls();
    this.buildZoomControls();
  }

  /**
   * Get the container of all the added 3D elements.
   * Useful when rendering via React.
   * @returns {HTMLElement} Container of all rendered 3D elements.
   */
  getRenderers() {
    return [this.css2dRenderer.domElement, this.css3dRenderer.domElement];
  }

  /**
   * Get the position the camera is currently pointing at.
   * @returns {object} Yaw and pitch of camera.
   */
  getCurrentPosition() {
    return {
      yaw: -this.camera.rotation.y,
      pitch: this.camera.rotation.x
    };
  }

  /**
   * Get current field of view.
   * @returns {number} Field of view.
   */
  getCurrentFov() {
    return this.camera.getEffectiveFOV();
  }

  /**
   * Get scene container element.
   * @returns {HTMLElement} Scene container element.
   */
  getElement() {
    return this.element;
  }

  /**
   * Change the number of segments used to create the sphere.
   * Note: Rendering has to be stopped and started again for these changes
   * to take affect. (Due to memory management)
   * @param {number} numSegments Number of segments.
   */
  setSegmentNumber(numSegments) {
    this.options.segments = numSegments;
  }

  /**
   * Change the sourceElement of the world sphere.
   * Useful for changing scenes.
   * @param {HTMLElement} element Video or image source.
   * @param {boolean} isPanorama If true, source is panorama scene.
   * @param {boolean} enableZoom If true, enable zoom.
   */
  setSourceElement(element, isPanorama, enableZoom) {
    this.sourceElement = element;
    this.options.isPanorama = isPanorama;
    this.options.enableZoom = enableZoom;

    const fov = this.options.isPanorama ? FOV_PANORAMA : FOV_SPHERE;

    this.camera.fov = fov;
    this.fieldOfView = fov;

    this.camera.updateProjectionMatrix();

    this.cameraControls.setPanorama(this.options.isPanorama);
    this.zoomControls.setEnableZoom(this.options.enableZoom);
    this.zoomControls.setMaxFov(fov);
  }

  /**
   * Stop camera from centering on elements.
   * @param {boolean} state If true, prevent camera centering.
   */
  setPreventCameraMovement(state) {
    this.preventCameraMovement = state;
  }

  /**
   * Set the current camera position.
   * The default center/front part of an equirectangular image is usually
   * the center of image.
   * @param {number} yaw Horizontal angle
   * @param {number} pitch Vertical angle
   */
  setCameraPosition(yaw, pitch) {
    if (this.preventDeviceOrientation) {
      return; // Prevent other code from setting position while user is dragging
    }

    this.camera.rotation.y = -yaw;
    this.camera.rotation.x = this.options.isPanorama ? 0 : pitch;
  }

  /**
   * Resize.
   * @param {number} newRatio New aspect ratio.
   */
  resize(newRatio) {
    if (!this.element.clientWidth) {
      return;
    }

    if (newRatio) {
      this.camera.aspect = newRatio;
      this.camera.updateProjectionMatrix();
    }
    else {
      newRatio = this.options.ratio; // Avoid replacing the original
    }

    // Resize main wrapping element
    this.element.style.height = `${this.element.clientWidth / newRatio}px`;

    // Resize renderers
    ['renderer', 'css2dRenderer', 'css3dRenderer'].forEach((renderer) => {
      this[renderer].setSize(
        this.element.clientWidth, this.element.clientHeight
      );
    });
  }

  /**
   * Add element to "CSS 3d world".
   * @param {HTMLElement} element Element to add.
   * @param {object} startPosition Start position.
   * @param {boolean} enableControls If true, enable controls.
   * @returns {H5P.ThreeJS.CSS3DObject} ThreeJS CSS3DObject.
   */
  add(element, startPosition, enableControls) {
    let threeElement;

    if (element.classList.contains('render-in-3d')) {
      threeElement = new H5P.ThreeJS.CSS3DObject(element);
      threeElement.is3d = true;
    }
    else {
      threeElement = new H5P.ThreeJS.CSS2DObject(element);
    }

    this.threeElements.push(threeElement);

    // Reset HUD values
    element.style.left = '0';
    element.style.top = '0';

    // Move camera to element when tabbing
    element.addEventListener('focus', (event) => {
      if (!event.defaultPrevented && !this.preventCameraMovement) {
        this.setCameraPosition(
          -threeElement.rotation.y, threeElement.rotation.x
        );
      }

      this.setPreventCameraMovement(false);
    }, false);

    if (enableControls) {
      const elementControls = new PositionControls(element);

      // Relay and supplement startMoving event
      elementControls.on('movestart', (event) => {
        // Set camera start position
        elementControls.startY = -threeElement.rotation.y;
        elementControls.startX = threeElement.rotation.x;

        this.preventDeviceOrientation = true;
        this.trigger(event);
      });

      // Update element position according to movement
      elementControls.on('move', (event) => {
        let pitch = elementControls.startX - event.beta;

        // Limit pitch for panorama
        if (this.options.isPanorama) {
          const MAX_PITCH = 0.42;
          pitch = Math.max(Math.min(pitch, MAX_PITCH ), -MAX_PITCH);
        }
        
        NDLAThreeSixty.setElementPosition(threeElement, {
          yaw: elementControls.startY + event.alpha,
          pitch: pitch
        });
      });

      // Relay and supplement stopMoving event
      elementControls.on('movestop', (event) => {
        event.data = {
          target: element,
          yaw: -threeElement.rotation.y,
          pitch: threeElement.rotation.x
        };

        this.preventDeviceOrientation = false;
        this.trigger(event);
      });
    }

    // Set initial position
    NDLAThreeSixty.setElementPosition(threeElement, startPosition);

    this.cssScene.add(threeElement);

    return threeElement;
  }

  /**
   * Remove element from "CSS world".
   * @param {H5P.ThreeJS.CSS3DObject} threeElement Element to be removed.
   */
  remove(threeElement) {
    this.threeElements.splice(this.threeElements.indexOf(threeElement), 1);
    this.cssScene.remove(threeElement);
  }

  /**
   * Find the threeElement for the given element.
   * @param {Element} element Element.
   * @returns {H5P.ThreeJS.CSS3DObject} Corresponding ThreeJS CSS3DObject.
   */
  find(element) {
    return this.threeElements.find((threeElement) => {
      return threeElement.element === element;
    });
  }

  /**
   * Will re-create the world sphere. Useful after changing sourceElement
   * or segment number.
   *
   * Note that this will have to be called initally to create the sphere as
   * well to allow for full control.
   */
  update() {
    if (this.sphere) {
      this.disposeSphere();
    }

    if (this.options.isPanorama) {
      this.createCylinder();
    }
    else {
      this.createSphere();
    }

    this.triggerFirstRenderEvent = true;
  }

  /**
   * Update source.
   * Triggers redraw of texture fetched from the sourceElement.
   */
  updateSource() {
    this.sphere.material.map.needsUpdate = true;
  }

  /**
   * Set focus to the scene.
   */
  focus() {
    this.css2dRenderer.domElement.focus();
  }

  /**
   * Change the tabindex attribute of the scene element
   * @param {boolean} enable If true, allow tabbing. Else not.
   */
  setTabIndex(enable) {
    this.css2dRenderer.domElement.tabIndex = (enable ? '0' : '-1');
    this.css3dRenderer.domElement.tabIndex = (enable ? '0' : '-1');
  }

  /**
   * Set label for the application element (camera controls).
   * @param {string} label Label.
   */
  setAriaLabel(label) {
    this.css2dRenderer.domElement.setAttribute('aria-label', label);
    this.css2dRenderer.domElement.setAttribute('role', 'document');

    this.css3dRenderer.domElement.setAttribute('aria-label', label);
    this.css3dRenderer.domElement.setAttribute('role', 'document');
  }

  /**
   * Start rendering scene
   */
  startRendering() {
    if (this.renderLoopId !== null) {
      return; // Prevent double rendering
    }

    window.requestAnimationFrame(() => {
      /*
       * Since the 2D environment is rendered as "screen space overlay",
       * it will always be "closest" to the camera. By putting the
       * this.css3dRenderer as the first child of this.css2dRenderer, we retain
       * events such as onClick, etc and pseudo-classes (hover etc) on all
       * elements in scene
       */
      this.css2dRenderer.domElement.insertBefore(
        this.css3dRenderer.domElement,
        this.css2dRenderer.domElement.firstChild
      );
    });

    this.render();
  }

  /**
   * Stop rendering scene
   */
  stopRendering() {
    cancelAnimationFrame(this.renderLoopId);
    this.renderLoopId = null;
  }

  /**
   * Render scene.
   */
  render() {
    // Draw scenes
    this.renderer.render(this.scene, this.camera);
    this.css2dRenderer.render(this.cssScene, this.camera);
    this.css3dRenderer.render(this.cssScene, this.camera);

    // Prepare next render
    this.renderLoopId = window.requestAnimationFrame(() => {
      this.render();
    });

    if (this.triggerFirstRenderEvent) {
      this.triggerFirstRenderEvent = false;
      this.trigger('firstrender');
    }
  }

  /**
   * Set element's position in the 3d world, always facing the camera.
   * @param {H5P.ThreeJS.CSS3DObject} threeElement CSS3DObject.
   * @param {object} position Position object.
   * @param {number} position.yaw Radians from 0 to Math.PI*2 (0-360).
   * @param {number} position.pitch Radians from -Math.PI/2 to Math.PI/2 (-90-90).
   */
  static setElementPosition(threeElement, position) {
    const radius = 800; // Default radius of 800

    threeElement.position.x = radius *
      Math.sin(position.yaw) * Math.cos(position.pitch);

    threeElement.position.y = radius *
      Math.sin(position.pitch);

    threeElement.position.z = -radius *
      Math.cos(position.yaw) * Math.cos(position.pitch);

    threeElement.rotation.order = DEFAULT_ROTATION_ORDER;
    threeElement.rotation.y = -position.yaw;
    threeElement.rotation.x = +position.pitch;
  }
}
