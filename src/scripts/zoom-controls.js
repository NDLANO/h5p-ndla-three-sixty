import { FOV_PANORAMA, FOV_SPHERE } from "@services/constants";

/** 
 * Zoom controls for ThreeJS based on OrbitControls.js
 * @see https://github.com/mrdoob/three.js/blob/r101/examples/jsm/controls/OrbitControls.js 
 */
export default class ZoomControls extends H5P.EventDispatcher {

  /**
   * Class for manipulating element zoom using different controls.
   * @class
   * @param {object} object The camera object to manipulate.
   * @param {object} domElement DOM element to listen for events on.
   * @param {boolean} isPanorama Whether the object is a panorama.
   */
  constructor(object, domElement, isPanorama) {
    super();

    this.object = object;

    this.domElement = (domElement !== undefined) ? domElement : document;

    // Set to false to disable this control
    this.enabled = true;
    
    // How far you can dolly in and out ( PerspectiveCamera only )
    this.minFov = 20;
    this.maxFov = isPanorama ? FOV_PANORAMA : FOV_SPHERE;

    // How far you can zoom in and out ( OrthographicCamera only )
    this.minZoom = ZoomControls.ZOOM_MIN;
    this.maxZoom = ZoomControls.ZOOM_MAX;

    // This option actually enables dollying in and out; left as "zoom" for
    // backwards compatibility.
    // Set to false to disable zooming
    this.enableZoom = true;
    this.zoomSpeed = 1.0;

    this.enablePan = false;

    // for reset
    //this.target0 = this.target.clone();
    //this.position0 = this.object.position.clone();
    //this.zoom0 = this.object.zoom;

    this.dollyStart = new H5P.ThreeJS.Vector2();
    this.dollyEnd = new H5P.ThreeJS.Vector2();
    this.dollyDelta = new H5P.ThreeJS.Vector2();

    this.zoomChanged = false;

    // Register event listeners
    //this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this), false);
    domElement.addEventListener('wheel', this.onMouseWheel.bind(this), false);

    //this.domElement.addEventListener('touchstart', this.onTouchStart.bind(this), false);
    //this.domElement.addEventListener('touchend', this.onTouchEnd.bind(this), false);
    //this.domElement.addEventListener('touchmove', this.onTouchMove.bind(this), false);
  }

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
   * @param {*} dollyScale 
   * @returns 
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
      this.zoomChanged = true;
    }
  }

  /**
   * Dollies out the camera e.g. zoom out.
   * @param {*} dollyScale 
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
      this.zoomChanged = true;
    }
  }

  handleMouseDownDolly(event) {
    this.dollyStart.set(event.clientX, event.clientY);
  }

  handleMouseMoveDolly(event) {
    this.dollyEnd.set(event.clientX, event.clientY);

    this.dollyDelta.subVectors(this.dollyEnd, this.dollyStart);

    if (this.dollyDelta.y > 0) {
      this.dollyIn();
    } else if (this.dollyDelta.y < 0) {
      this.dollyOut();
    }

    this.dollyStart.copy(this.dollyEnd);
  }

  handleMouseWheel(event) {
    if (event.deltaY < 0) {
      this.dollyIn(this.getZoomScale());
    } else if (event.deltaY > 0) {
      this.dollyOut(this.getZoomScale());
    }
  }

  handleTouchStartDollyPan(event) {
    if (this.enableZoom) {
      var dx = event.touches[0].pageX - event.touches[1].pageX;
      var dy = event.touches[0].pageY - event.touches[1].pageY;

      var distance = Math.sqrt(dx * dx + dy * dy);

      this.dollyStart.set(0, distance);
    }

    if (this.enablePan) {
      var x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
      var y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);

      this.panStart.set(x, y);
    }
  }

  handleTouchMoveDollyPan(event) {
    if (this.enableZoom) {
      var dx = event.touches[0].pageX - event.touches[1].pageX;
      var dy = event.touches[0].pageY - event.touches[1].pageY;

      var distance = Math.sqrt(dx * dx + dy * dy);

      this.dollyEnd.set(0, distance);

      this.dollyDelta.subVectors(this.dollyEnd, this.dollyStart);

      if (this.dollyDelta.y > 0) {
        this.dollyOut();
      } else if (this.dollyDelta.y < 0) {
        this.dollyIn();
      }

      this.dollyStart.copy(this.dollyEnd);
    }
  }

  onTouchStart(event) {
    if (this.enableZoom === false) return;

    this.handleTouchStartDollyPan(event);
  }

  onTouchMove(event) {
    if (this.enableZoom === false) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.touches.length === 2) {
      if (this.enablePan) {
        this.handleTouchMoveDollyPan(event);
      }
    }
  }

  onTouchEnd(event) {
    if (this.enableZoom === false) return;

    this.handleTouchEnd(event);
  }

  onMouseWheel(event) {
    if (this.enableZoom === false) return;

    event.preventDefault();
    event.stopPropagation();

    this.handleMouseWheel(event);
  }
}

/** @constant {number} ZOOM_MIN Minimum zoom value. */
ZoomControls.ZOOM_MIN = 1;

/** @constant {number} ZOOM_MAX Maximum zoom value. */
ZoomControls.ZOOM_MAX = 100;