import PositionControls from '@scripts/position-controls';

/**
 * The 360 degree panorama viewer with support for virtual reality.
 * @class H5P.NDLAThreeSixty
 * @augments H5P.EventDispatcher
 * @param {HTMLElement} sourceElement Video or image source.
 * @param {object} options Options.
 * @param {number} options.ratio Display ratio of the viewport
 * @param {object} options.cameraStartPosition
 * @param {number} options.cameraStartPosition.yaw 0 = Center of image.
 * @param {number} options.cameraStartPosition.pitch 0 = Center of image.
 * @param {number} options.segments Number of segments.
 * @param {boolean} options.isPanorama If true, scene is panorama scene.
 */
export default class NDLAThreeSixty extends H5P.EventDispatcher {
  constructor(sourceElement, options) {
    super();

    this.sourceElement = sourceElement;

    // Settings
    const fieldOfView = options.isPanorama ? 53 : 75;
    const near = 0.1;
    const far = 1000;
    this.ratio = options.ratio ? options.ratio : 16 / 9;

    // Main wrapper element
    this.element = document.createElement('div');
    this.element.classList.add('h5p-three-sixty');

    // TODO: ThreeSixty should not have to deal with this, this belongs in a
    // a separate collection/array class. (ThreeSixty should just add or remove
    // elements from the 3d world, not keep an indexed mapping for the
    // consumer/user of this library.)
    this.threeElements = [];

    this.preventCameraMovement = false;

    /**
     * Help set up renderers and add them to the main wrapper element.
     * @param {H5P.ThreeJS.Object3D|H5P.ThreeJS.WebGLRenderer} renderer Renderer.
     * @returns {H5P.ThreeJS.Object3D|H5P.ThreeJS.WebGLRenderer} Amended renderer.
     */
    const add = (renderer) => {
      renderer.domElement.classList.add('h5p-three-sixty-scene');
      this.element.append(renderer.domElement);

      return renderer;
    };

    // Create scene, add camera and a WebGL renderer
    this.scene = new H5P.ThreeJS.Scene();
    this.camera = new H5P.ThreeJS.PerspectiveCamera(
      fieldOfView, this.ratio, near, far
    );
    this.camera.rotation.order = 'YXZ';

    const camPos = options.cameraStartPosition || {};
    this.setCameraPosition(
      camPos.yaw !== undefined ? camPos.yaw : -(Math.PI * (2 / 3)),
      camPos.pitch !== undefined ? camPos.pitch : 0
    );

    this.radius = 10;
    this.segmentation = options.segments || 4;

    this.sphere;
    this.renderLoopId = null;

    this.renderer = add(new H5P.ThreeJS.WebGLRenderer());

    this.css2dRenderer = add(new H5P.ThreeJS.CSS2DRenderer);
    this.css2dRenderer.domElement.classList.add('h5p-three-sixty-2d');

    this.css3dRenderer = add(new H5P.ThreeJS.CSS3DRenderer);
    this.css3dRenderer.domElement.classList.add('h5p-three-sixty-3d');

    // Create a scene for our "CSS world"
    this.cssScene = new H5P.ThreeJS.Scene();

    // Add camera controls
    this.cameraControls = new PositionControls(
      this.css2dRenderer.domElement, 400, true, true, options.isPanorama
    );

    // Workaround for touchevent not cancelable when CSS 'perspective' is set.
    this.renderer.domElement.addEventListener('touchmove', () => {});
    // This appears to be a bug in Chrome.

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
      const radsFromCameraCenter = NDLAThreeSixty.toRad(fieldOfView) / 2;
      if (pitch + radsFromCameraCenter > NDLAThreeSixty.MAX_PITCH) {
        pitch = NDLAThreeSixty.MAX_PITCH - radsFromCameraCenter;
      }
      else if (pitch - radsFromCameraCenter < -NDLAThreeSixty.MAX_PITCH) {
        pitch = -NDLAThreeSixty.MAX_PITCH + radsFromCameraCenter;
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

    // Add approperiate styling
    this.css2dRenderer.domElement.classList.add('h5p-three-sixty-controls');
    this.css3dRenderer.domElement.classList.add('h5p-three-sixty-controls');
  }

  /**
   * Find the threeElement for the given element.
   * TODO: Move into a separate collection handling class
   * @param {Element} element Element.
   * @returns {H5P.ThreeJS.CSS3DObject} Corresponding ThreeJS CSS3DObject.
   */
  find(element) {
    return this.threeElements.find((threeElement) => {
      return threeElement.element === element;
    });
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
      newRatio = this.ratio; // Avoid replacing the original
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
        NDLAThreeSixty.setElementPosition(threeElement, {
          yaw: elementControls.startY + event.alpha,
          pitch: elementControls.startX - event.beta
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

      // Move camera to element when tabbing
      element.addEventListener('focus', (event) => {
        if (!event.defaultPrevented && !this.preventCameraMovement) {
          this.setCameraPosition(
            -threeElement.rotation.y, threeElement.rotation.x
          );
        }

        this.setPreventCameraMovement(false);
      }, false);
    }

    // Set initial position
    NDLAThreeSixty.setElementPosition(threeElement, startPosition);

    this.cssScene.add(threeElement);
    return threeElement;
  }

  /**
   * Used to stop camera from centering on elements.
   * @param {boolean} setPreventCameraMovement If true, prevent camera movement.
   */
  setPreventCameraMovement(setPreventCameraMovement) {
    this.preventCameraMovement = setPreventCameraMovement;
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
    this.createSphere();

    this.triggerFirstRenderEvent = true;
  }

  /**
   * Update cylinder.
   */
  updateCylinder() {
    if (this.sphere) {
      this.disposeSphere();
    }
    this.createCylinder();

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
   * Create the world sphere with its needed resources.
   */
  createSphere() {
    // Create a sphere surrounding the camera with the source texture
    const geometry = new H5P.ThreeJS.SphereGeometry(
      this.radius, this.segmentation, this.segmentation
    );

    // Create material with texture from source element
    const material = new H5P.ThreeJS.MeshBasicMaterial({
      map: new H5P.ThreeJS.Texture(
        this.sourceElement,
        H5P.ThreeJS.UVMapping,
        H5P.ThreeJS.ClampToEdgeWrapping,
        H5P.ThreeJS.ClampToEdgeWrapping,
        H5P.ThreeJS.LinearFilter,
        H5P.ThreeJS.LinearFilter,
        H5P.ThreeJS.RGBFormat
      )
    });
    material.map.needsUpdate = true;

    // Prepare sphere and add to scene
    this.sphere = new H5P.ThreeJS.Mesh(geometry, material);
    geometry.scale(-1, 1, 1); // Flip to make front side face inwards

    this.scene.add(this.sphere);
  }

  /**
   * Create the world cylinder with its needed resources.
   */
  createCylinder() {
    // Create a cylinder surrounding the camera with the source texture
    const geometry = new H5P.ThreeJS.CylinderGeometry(
      this.radius, this.radius, this.radius,
      this.segmentation, this.segmentation, true
    );

    // Create material with texture from source element
    const material = new H5P.ThreeJS.MeshBasicMaterial({
      map: new H5P.ThreeJS.Texture(
        this.sourceElement,
        H5P.ThreeJS.UVMapping,
        H5P.ThreeJS.ClampToEdgeWrapping,
        H5P.ThreeJS.ClampToEdgeWrapping,
        H5P.ThreeJS.LinearFilter,
        H5P.ThreeJS.LinearFilter,
        H5P.ThreeJS.RGBFormat
      )
    });
    material.map.needsUpdate = true;

    // Prepare cylinder and add to scene
    this.sphere = new H5P.ThreeJS.Mesh(geometry, material);
    geometry.scale(-1, 1, 1); // Flip to make front side face inwards

    this.scene.add(this.sphere);
  }

  /**
   * Remove sphere resources from memory.
   * @private
   */
  disposeSphere() {
    this.scene.remove(this.sphere);

    this.sphere.geometry.dispose();
    this.sphere.material.dispose();
    this.sphere.material.map.dispose();
    this.sphere = null;
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
    this.camera.rotation.x = this.isPanorama ? 0 : pitch;

    // TODO: Figure out why this is here and what it does
    this.trigger('movestop', { pitch: pitch, yaw: yaw });
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
   * Set focus to the scene.
   */
  focus() {
    this.css2dRenderer.domElement.focus();
  }

  /**
   * Change the number of segments used to create the sphere.
   * Note: Rendering has to be stopped and started again for these changes
   * to take affect. (Due to memory management)
   * @param {number} numSegments Number of segments.
   */
  setSegmentNumber(numSegments) {
    this.segmentation = numSegments;
  }

  /**
   * Change the sourceElement of the world sphere.
   * Useful for changing scenes.
   * @param {HTMLElement} element Video or image source.
   * @param {boolean} isPanorama If true, source is panorama scene.
   */
  setSourceElement(element, isPanorama) {
    this.sourceElement = element;
    this.isPanorama = isPanorama;

    this.camera.fov = this.isPanorama ? 53 : 75;
    this.camera.updateProjectionMatrix ();

    this.cameraControls.setPanorama(this.isPanorama);
  }

  /**
   * Set label for the application element (camera controls).
   * @param {string} label Label.
   */
  setAriaLabel(label) {
    // TODO: Separate setting for document role?
    this.css2dRenderer.domElement.setAttribute('aria-label', label);
    this.css2dRenderer.domElement.setAttribute('role', 'document');

    // TODO: Separate setting for document role?
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
   * Convert deg to rad
   * @param {number} value Degree value.
   * @returns {number} Radians value.
   */
  static toRad(value) {
    return value * (Math.PI / 180);
  }
}

/**
 * Set element's position in the 3d world, always facing the camera.
 * @param {H5P.ThreeJS.CSS3DObject} threeElement CSS3DObject.
 * @param {object} position Position object.
 * @param {number} position.yaw Radians from 0 to Math.PI*2 (0-360).
 * @param {number} position.pitch Radians from -Math.PI/2 to Math.PI/2 (-90-90).
 */
NDLAThreeSixty.setElementPosition = (threeElement, position) => {
  const radius = 800;

  threeElement.position.x = radius *
    Math.sin(position.yaw) * Math.cos(position.pitch);

  threeElement.position.y = radius *
    Math.sin(position.pitch);

  threeElement.position.z = -radius *
    Math.cos(position.yaw) * Math.cos(position.pitch);

  threeElement.rotation.order = 'YXZ';
  threeElement.rotation.y = -position.yaw;
  threeElement.rotation.x = +position.pitch;
};

/** @constant {number} MAX_PITCH Maximum pitch. */
NDLAThreeSixty.MAX_PITCH = Math.PI / 2;
