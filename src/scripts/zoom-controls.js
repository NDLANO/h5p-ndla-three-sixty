import { FOV_PANORAMA, FOV_SPHERE, ZOOM_MIN, ZOOM_MAX } from '@services/constants';

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
   */
  constructor(object, element, isPanorama) {
    super();

    this.object = object;

    this.element = (element !== undefined) ? element : document;

    // Set to false to disable this control
    this.enabled = true;
    
    // How far you can dolly in and out ( PerspectiveCamera only )
    this.minFov = 20;
    this.maxFov = isPanorama ? FOV_PANORAMA : FOV_SPHERE;

    // How far you can zoom in and out ( OrthographicCamera only )
    this.minZoom = ZOOM_MIN;
    this.maxZoom = ZOOM_MAX;

    // Set to false to disable zooming
    this.enableZoom = true;
    this.zoomSpeed = 1.0;

    this.dollyStart = new H5P.ThreeJS.Vector2();
    this.dollyEnd = new H5P.ThreeJS.Vector2();
    this.dollyDelta = new H5P.ThreeJS.Vector2();

    // Register event listeners
    element.addEventListener('wheel', this.onMouseWheel.bind(this), false);
    element.addEventListener('touchstart', this.onTouchStart.bind(this), false);
    element.addEventListener('touchmove', this.onTouchMove.bind(this), false);
    element.addEventListener('keydown', this.onKeyDown.bind(this), false);
  }

  /**
   * Get zoom scale.
   * @returns {number} Zoom scale.
   */
  getZoomScale() {
    return Math.pow(0.95, this.zoomSpeed);
  }

  isDollyInDisabled() {
    return this.object.isPerspectiveCamera && this.object.fov <= this.minFov;
  }

  isDollyOutDisabled() {
    return this.object.isPerspectiveCamera && this.object.fov >= this.maxFov;
  }

  /**
   * Dollies in the camera e.g. zoom in.
   * @param {number} dollyScale How much to dolly in.
   */
  dollyIn(dollyScale) {
    if (dollyScale === undefined) {
      dollyScale = this.getZoomScale();
    }

    if (this.object.isPerspectiveCamera) {
      this.object.fov = Math.max(this.minFov, Math.min(this.maxFov, this.object.fov * dollyScale));
      this.object.updateProjectionMatrix();
    }
    else if (this.object.isOrthographicCamera) {
      this.object.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.object.zoom * dollyScale));
      this.object.updateProjectionMatrix();
    }
  }

  /**
   * Dollies out the camera e.g. zoom out.
   * @param {number} dollyScale How much to dolly out.
   */
  dollyOut(dollyScale) {
    if (dollyScale === undefined) {
      dollyScale = this.getZoomScale();
    }

    if (this.object.isPerspectiveCamera) {
      this.object.fov = Math.max(this.minFov, Math.min(this.maxFov, this.object.fov / dollyScale));
      this.object.updateProjectionMatrix();
    }
    else if (this.object.isOrthographicCamera) {
      this.object.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.object.zoom / dollyScale));
      this.object.updateProjectionMatrix();
    }
  }

  /**
   * Handle mouse wheel.
   * @param {WheelEvent} event Mouse wheel event.
   */
  handleMouseWheel(event) {
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
  handleTouchStartDolly(event) {
    var dx = event.touches[0].pageX - event.touches[1].pageX;
    var dy = event.touches[0].pageY - event.touches[1].pageY;

    var distance = Math.sqrt(dx * dx + dy * dy);

    this.dollyStart.set(0, distance);
  }

  /**
   * Handle touch move.
   * @param {TouchEvent} event Touch event.
   */
  handleTouchMoveDolly(event) {    
    var dx = event.touches[0].pageX - event.touches[1].pageX;
    var dy = event.touches[0].pageY - event.touches[1].pageY;

    var distance = Math.sqrt(dx * dx + dy * dy);

    this.dollyEnd.set(0, distance);

    this.dollyDelta.set(0, Math.pow(this.dollyEnd.y / this.dollyStart.y, this.zoomSpeed));  
      
    if (this.dollyDelta.y < 1) {
      this.dollyOut();
    } 
    else if (this.dollyDelta.y > 1) {
      this.dollyIn();
    }
  }

  /**
   * Handle key down.
   * @param {KeyboardEvent} event Keyboard event.
   */
  handleKeyDown(event) {
    switch (event.key) {
      case '-': // minus key
        this.dollyOut();
        break;
      case '+': // plus key
        this.dollyIn();
        break;
    }
  }

  /**
   * Handle touch start.
   * @param {TouchEvent} event Touch event.
   */
  onTouchStart(event) {
    if (this.enableZoom === false) return;

    // Only zoom if two fingers are used, pointer-controls will handle one finger movement
    if (event.touches.length === 2) {
      this.handleTouchStartDolly(event);
    }
  }

  /**
   * Handle touch move.
   * @param {TouchEvent} event Touch event.
   */
  onTouchMove(event) {
    if (this.enableZoom === false) return;

    event.preventDefault();
    event.stopPropagation();

    // Only zoom if two fingers are used, pointer-controls will handle one finger movement
    if (event.touches.length === 2) {
      this.handleTouchMoveDolly(event);
    }
  }

  /**
   * Handle touch end.
   * @param {TouchEvent} event Touch event.
   */
  onTouchEnd(event) {
    if (this.enableZoom === false) return;

    this.handleTouchEnd(event);
  }

  /**
   * Handle mouse wheel.
   * @param {WheelEvent} event Mouse wheel event.
   */
  onMouseWheel(event) {
    if (this.enableZoom === false) return;

    event.preventDefault();
    event.stopPropagation();

    this.handleMouseWheel(event);
  }

  /**
   * Handle key down.
   * @param {KeyboardEvent} event Keyboard event.
   */
  onKeyDown(event) {
    if (this.enableZoom === false) return;

    this.handleKeyDown(event);
  }
}
