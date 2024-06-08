import { FOV_PANORAMA, FOV_SPHERE, ZOOM_MIN, ZOOM_MAX, ZOOM_SPEED, ZOOM_SPEED_TOUCH } from '@services/constants';

/** 
 * Zoom controls for ThreeJS based on OrbitControls.js
 * @see https://github.com/mrdoob/three.js/blob/r101/examples/jsm/controls/OrbitControls.js 
 */
export default class ZoomControls extends H5P.EventDispatcher {

  /**
   * Class for manipulating element zoom using different controls.
   * @class
   * @param {object} object The camera object to manipulate.
   * @param {H5P.ThreeJS.Object3D} element DOM element of the ThreeJS object.
   * @param {boolean} isPanorama Whether the object is a panorama.
   * @param {boolean} enableZoom Whether to enable zoom.
   */
  constructor(object, element, isPanorama, enableZoom) {
    super();

    this.object = object;

    this.element = (element !== undefined) ? element : document;
    
    // How far you can dolly in and out ( PerspectiveCamera only )
    this.minFov = 15;
    this.maxFov = isPanorama ? FOV_PANORAMA : FOV_SPHERE;

    // How far you can zoom in and out ( OrthographicCamera )
    this.minZoom = ZOOM_MIN;
    this.maxZoom = ZOOM_MAX;

    this.zoomPercentage = 0;

    // Set to false to disable zooming
    this.enableZoom = enableZoom;
    this.zoomSpeed = ZOOM_SPEED;

    this.dollyStart = new H5P.ThreeJS.Vector2();
    this.dollyEnd = new H5P.ThreeJS.Vector2();
    this.dollyDelta = new H5P.ThreeJS.Vector2();

    // Register event listeners
    element.addEventListener('wheel', this.handleMouseWheel.bind(this), false);
    element.addEventListener('touchstart', this.handleTouchStart.bind(this), false);
    element.addEventListener('touchmove', this.handleTouchMove.bind(this), false);
    element.addEventListener('keydown', this.handleKeyDown.bind(this), false);
  }

  /**
   * Set state for enable zoom.
   * @param {boolean} state If true, zoom is enabled.
   */
  setEnableZoom(state) {
    this.enableZoom = state;
  }

  /**
   * Set state for max fov.
   * @param {number} fov Max fov.
   */
  setMaxFov(fov) {
    this.maxFov = fov;
  }

  /**
   * Set zoom percentage.
   */
  setZoomPercentage() {
    if (this.object.isPerspectiveCamera) {
      this.zoomPercentage = 100 - Math.round((this.object.fov - this.minFov) / (this.maxFov - this.minFov) * 100);
    }
    else {
      this.zoomPercentage = 100 - Math.round((this.object.zoom - this.minZoom) / (this.maxZoom - this.minZoom) * 100);
    }
  }

  /**
   * Get zoom scale.
   * @returns {number} Zoom scale.
   */
  getZoomScale() {
    return Math.pow(0.95, this.zoomSpeed);
  }

  /**
   * Check if dolly in is disabled.
   * @returns {boolean} True if dolly in is disabled.
   */
  isDollyInDisabled() {
    if (this.object.isPerspectiveCamera) {
      return this.object.fov <= this.minFov;
    }
    return this.object.zoom >= this.maxZoom;
  }

  /**
   * Check if dolly out is disabled.
   * @returns {boolean} True if dolly out is disabled.
   */
  isDollyOutDisabled() {
    if (this.object.isPerspectiveCamera) {
      return this.object.isPerspectiveCamera && this.object.fov >= this.maxFov;
    }
    return this.object.zoom <= this.minZoom;
  }

  /**
   * Dollies in the camera e.g. zoom in.
   * @param {number} dollyScale How much to dolly in.
   */
  dollyIn(dollyScale) {
    if (this.isDollyInDisabled()) {
      return;
    }

    if (dollyScale === undefined) {
      dollyScale = this.getZoomScale();
    }

    if (this.object.isPerspectiveCamera) {
      this.object.fov = Math.max(this.minFov, Math.min(this.maxFov, this.object.fov * dollyScale));
      this.object.updateProjectionMatrix();
    }
    else {
      this.object.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.object.zoom / dollyScale));
      this.object.updateProjectionMatrix();
    }

    this.setZoomPercentage();
    const zoomEvent = new H5P.Event('zoomin');
    this.trigger(zoomEvent);
  }

  /**
   * Dollies out the camera e.g. zoom out.
   * @param {number} dollyScale How much to dolly out.
   */
  dollyOut(dollyScale) {
    if (this.isDollyOutDisabled()) {
      return;
    }

    if (dollyScale === undefined) {
      dollyScale = this.getZoomScale();
    }

    if (this.object.isPerspectiveCamera) {
      this.object.fov = Math.max(this.minFov, Math.min(this.maxFov, this.object.fov / dollyScale));
      this.object.updateProjectionMatrix();
    }
    else {
      this.object.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.object.zoom * dollyScale));
      this.object.updateProjectionMatrix();
    }

    this.setZoomPercentage();
    const zoomEvent = new H5P.Event('zoomout');
    this.trigger(zoomEvent);
  }

  /**
   * Handle mouse wheel.
   * @param {WheelEvent} event Mouse wheel event.
   */
  handleMouseWheel(event) {
    if (!this.enableZoom) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.deltaY < 0) {
      this.dollyIn(this.getZoomScale());
    } 
    else if (event.deltaY > 0) {
      this.dollyOut(this.getZoomScale());
    }
  }

  /**
   * Handle touch start.
   * @param {TouchEvent} event Touch event.
   */
  handleTouchStart(event) {
    if (!this.enableZoom) {
      return;
    }
    // Only zoom if two fingers are used, pointer-controls will handle one finger movement
    if (event.touches.length !== 2) {
      return;
    }

    const dx = event.touches[0].pageX - event.touches[1].pageX;
    const dy = event.touches[0].pageY - event.touches[1].pageY;

    const distance = Math.sqrt(dx * dx + dy * dy);

    this.dollyStart.set(0, distance);
  }

  /**
   * Handle touch move.
   * @param {TouchEvent} event Touch event.
   */
  handleTouchMove(event) {
    if (!this.enableZoom) {
      return;
    }
    // Only zoom if two fingers are used, pointer-controls will handle one finger movement
    if (event.touches.length !== 2) {   
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const dx = event.touches[0].pageX - event.touches[1].pageX;
    const dy = event.touches[0].pageY - event.touches[1].pageY;

    const distance = Math.sqrt(dx * dx + dy * dy);

    this.dollyEnd.set(0, distance);

    this.dollyDelta.set(0, Math.pow(this.dollyEnd.y / this.dollyStart.y, this.zoomSpeed));

    const zoomScale = Math.pow(0.95, ZOOM_SPEED_TOUCH);
      
    if (this.dollyDelta.y < 1) {
      this.dollyOut(zoomScale);
    } 
    else if (this.dollyDelta.y > 1) {
      this.dollyIn(zoomScale);
    }
  }

  /**
   * Handle key down.
   * @param {KeyboardEvent} event Keyboard event.
   */
  handleKeyDown(event) {
    if (!this.enableZoom) {
      return;
    }

    switch (event.key) {
      case '-': // minus key
        this.dollyOut();
        break;
      case '+': // plus key
        this.dollyIn();
        break;
    }
  }
}
