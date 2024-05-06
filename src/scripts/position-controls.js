import Util from '@services/util';
import { FOV_PANORAMA, FOV_SPHERE } from '@services/constants';

export default class PositionControls extends H5P.EventDispatcher {

  /**
   * Class for manipulating element position using different controls.
   * @class
   * @param {H5P.ThreeJS.Object3D} element ThreeJS Object3D.
   * @param {H5P.ThreeJS.PerspectiveCamera} [camera] Camera object.
   * @param {object} [options] Options.
   * @param {number} [options.friction] Determines the speed of the movement, higher = slower.
   * @param {boolean} [options.shouldInvert] Invert controls for camera.
   * @param {boolean} [options.isCamera] Is camera.
   * @param {boolean} [options.isPanorama] If true, scene is a panarama scene.
   */
  constructor(element, camera, options = {}) {
    super();

    this.element = element;
    this.camera = camera;

    this.options = Util.extend({
      friction: 800,
      shouldInvert: false,
      isCamera: false,
      isPanorama: false
    }, options);

    this.invert = options.shouldInvert ? 1 : -1;
    this.alpha = 0; // From 0 to 2pi
    this.beta = 0; // From -pi/2 to pi/2
    this.keyStillDown = null; // Used to determine if movement key is held down.

    [
      'handleMouseDown', 'handleMouseMove', 'handleMouseUp',
      'handleTouchStart', 'handleTouchMove', 'handleTouchEnd',
      'handleKeyDown', 'handleKeyUp', 'handleFocus'
    ].forEach((listener) => {
      this[listener] = this[listener].bind(this);
    });

    // Register event listeners to position element
    element.setAttribute('tabindex', '0');
    element.addEventListener('mousedown', this.handleMouseDown, false);
    element.addEventListener('touchstart', this.handleTouchStart, false);
    element.addEventListener('keydown', this.handleKeyDown, false);
    element.addEventListener('focus', this.handleFocus, false);
    element.setAttribute('role', 'application');
  }

  /**
   * @returns {number} Alpha value.
   */
  getAlpha() {
    return this.alpha;
  }

  /**
   * @returns {number} Beta value.
   */
  getBeta() {
    return this.beta;
  }

  /**
   * @param {string} [control] Check for specific control
   * @returns {boolean} True, if is moving.
   */
  isMoving(control) {
    return control ? this.controlActive === control : !!this.controlActive;
  }

  /**
   * Set panorama state for controls.
   * @param {boolean} state If true/false is/is not in panorama mode.
   */
  setPanorama(state) {
    if (typeof state !== 'boolean') {
      return;
    }

    this.options.isPanorama = state;
  }

  /**
   * Generic initialization when movement starts.
   * @param {number} x Initial x coordinate
   * @param {number} y Initial y coordinate
   * @param {string} control Identifier
   * @param {Event} [event] Original event
   * @returns {boolean} If it's safe to start moving
   */
  start(x, y, control, event) {
    if (this.controlActive) {
      return false; // Another control is active
    }

    // Trigger event when start moving, give other components chance to cancel
    const eventData = {
      element: this.element,
      isCamera: this.options.isCamera
    };

    if (event) {
      eventData.target = event.target;
    }

    const movestartEvent = new H5P.Event('movestart', eventData);
    movestartEvent.defaultPrevented = false;

    this.trigger(movestartEvent);

    if (movestartEvent.defaultPrevented) {
      return false; // Another component doesn't want us to start moving
    }

    // Set initial position
    this.startPosition = { x: x, y: y };
    this.alpha = 0;
    this.beta = 0;

    this.controlActive = control;

    return true;
  }

  /**
   * Generic deinitialization when movement stops.
   */
  end() {
    this.element.classList.remove('dragging');
    this.controlActive = false;

    this.trigger('movestop');
  }

  /**
   * Generic movement handler.
   * @param {number} deltaX Current deltaX coordinate.
   * @param {number} deltaY Current deltaY coordinate.
   * @param {number} friction Current friction.
   */
  move(deltaX, deltaY, friction) {
    // Prepare move event
    const moveEvent = new H5P.Event('move');

    if (this.camera?.fov) {
      // Update friction based on field of view (zoom)
      const maxFov = this.options.isPanorama ? FOV_PANORAMA : FOV_SPHERE;
      const frictionFactorZoom = this.camera.fov / maxFov;
      friction = friction / frictionFactorZoom;
    }

    // Update position relative to cursor speed
    moveEvent.alphaDelta = deltaX / friction;
    moveEvent.betaDelta = deltaY / friction;
    this.alpha = (this.alpha + moveEvent.alphaDelta) % (Math.PI * 2); // Max 360
    this.beta = (this.beta + moveEvent.betaDelta) % (Math.PI * 2); // Max 180

    // Max 90 degrees up and down on pitch
    const ninety = Math.PI / 2;
    this.beta = Math.max(-ninety, Math.min(this.beta, ninety));

    moveEvent.alpha = this.alpha;
    moveEvent.beta = this.beta;

    // Trigger move event
    this.trigger(moveEvent);
  }

  /**
   * Handle mouse down.
   * @param {MouseEvent} event Mouse event.
   */
  handleMouseDown(event) {
    if (event.button !== 0) {
      return; // Not left mouse button
    }

    if (!this.start(event.pageX, event.pageY, 'mouse', event)) {
      return; // Prevented by another component
    }

    // Prevent other elements from moving
    event.stopPropagation();

    // Register mouse move and up handlers
    window.addEventListener('mousemove', this.handleMouseMove, false);
    window.addEventListener('mouseup', this.handleMouseUp, false);
  }

  /**
   * Handle mouse move
   * @param {MouseEvent} event Mouse event.
   */
  handleMouseMove(event) {
    let xDiff = event.movementX;
    let yDiff = event.movementY;

    if (event.movementX === undefined || event.movementY === undefined) {
      // Diff on old values
      if (!this.prevPosition) {
        this.prevPosition = {
          x: this.startPosition.x,
          y: this.startPosition.y,
        };
      }
      xDiff = event.pageX - this.prevPosition.x;
      yDiff = event.pageY - this.prevPosition.y;

      this.prevPosition = {
        x: event.pageX,
        y: event.pageY,
      };
    }

    if (xDiff !== 0 || yDiff !== 0) {
      this.move(xDiff, yDiff, this.options.friction);
    }
  }

  /**
   * Handle mouse up
   */
  handleMouseUp() {
    this.prevPosition = null;

    window.removeEventListener('mousemove', this.handleMouseMove, false);
    window.removeEventListener('mouseup', this.handleMouseUp, false);

    this.end();
  }

  /**
   * Handle touch start.
   * @param {TouchEvent} event Touch event.
   */
  handleTouchStart(event) {
    if (!this.start(
      event.changedTouches[0].pageX, event.changedTouches[0].pageY, 'touch'
    )) {
      return;
    }

    this.element.addEventListener('touchmove', this.handleTouchMove, false);
    this.element.addEventListener('touchend', this.handleTouchEnd, false);
  }

  /**
   * Handle touch movement.
   * @param {TouchEvent} event Touch event.
   */
  handleTouchMove(event) {
    if (!event.cancelable) {
      return;
    }

    // Only move if one finger is used, zoom-controls will handle two finger movement
    if (event.touches.length > 1) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (!this.prevPosition) {
      this.prevPosition = {
        x: this.startPosition.x,
        y: this.startPosition.y,
      };
    }

    const deltaX = event.changedTouches[0].pageX - this.prevPosition.x;
    const deltaY = event.changedTouches[0].pageY - this.prevPosition.y;

    this.prevPosition = {
      x: event.changedTouches[0].pageX,
      y: event.changedTouches[0].pageY,
    };

    this.move(
      deltaX,
      deltaY,
      this.options.friction * PositionControls.FRICTION_FACTOR_TOUCH
    );
  }

  /**
   * Handle touch end.
   */
  handleTouchEnd() {
    this.prevPosition = null;
    this.element.removeEventListener('touchmove', this.handleTouchMove, false);
    this.element.removeEventListener('touchend', this.handleTouchEnd, false);

    this.end();
  }

  /**
   * Handle key down.
   * @param {KeyboardEvent} event Keyboard event.
   */
  handleKeyDown(event) {
    const isArrowKey = [
      'ArrowLeft', 'Numpad4', 'ArrowRight', 'Numpad6',
      'ArrowUp', 'Numpad8', 'ArrowDown', 'Numpad2'
    ].includes(event.code);

    if (!isArrowKey) {
      return;
    }

    if (this.keyStillDown === null) {
      // Try to start movement
      if (this.start(0, 0, 'keyboard')) {
        this.keyStillDown = event.code;
        this.element.addEventListener('keyup', this.handleKeyUp, false);
      }
    }

    // Prevent the default behavior
    event.preventDefault();
    event.stopPropagation();

    if (this.keyStillDown !== event.code) {
      return; // Not the same key as we started with
    }

    const delta = { x: 0, y: 0 };

    // Update movement in approperiate direction
    switch (event.code) {
      case 'ArrowLeft': // Intentional fallthrough
      case 'Numpad4':
        delta.x += this.invert;
        break;

      case 'ArrowUp': // Intentional fallthrough
      case 'Numpad8':
        delta.y += this.invert;
        break;

      case 'ArrowRight': // Intentional fallthrough
      case 'Numpad6':
        delta.x -= this.invert;
        break;

      case 'ArrowDown': // Intentional fallthrough
      case 'Numpad2':
        delta.y -= this.invert;
        break;
    }

    this.move(
      delta.x,
      delta.y,
      this.options.friction * PositionControls.FRICTION_FACTOR_KEYBOARD
    );
  }

  /**
   * Handle key up.
   */
  handleKeyUp() {
    this.keyStillDown = null;
    this.element.removeEventListener('keyup', this.handleKeyUp, false);

    this.end();
  }

  /**
   * Manually handle focusing to avoid scrolling the elements out of place.
   * @param {Event} event Event.
   */
  handleFocus(event) {
    event.preventDefault();
    event.target.focus({ preventScroll: true });
  }
}

/** @constant {number} FRICTION_FACTOR_KEYBOARD Friction factor for keyboard movement. */
PositionControls.FRICTION_FACTOR_KEYBOARD = 0.025;

/** @constant {number} FRICTION_FACTOR_KEYBOARD Friction factor for touch movement. */
PositionControls.FRICTION_FACTOR_TOUCH = 0.75;
