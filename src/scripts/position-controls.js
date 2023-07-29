/**
 * Class for manipulating element position using different controls.
 * @class
 * @param {H5P.ThreeJS.Object3D} element ThreeJS Object3D.
 * @param {number} [friction] Determines the speed of the movement, higher = slower.
 * @param {boolean} [shouldInvert] Invert controls for camera.
 * @param {boolean} [isCamera] Is camera.
 * @param {boolean} [isPanorama] If true, scene is a panarama scene.
 */
export default class PositionControls extends H5P.EventDispatcher {

  constructor(element, friction = 800, shouldInvert, isCamera = false, isPanorama = false) {
    super();

    this.element = element;
    this.friction = friction;
    this.invert = shouldInvert ? 1 : -1;
    this.isCamera = isCamera;
    this.isPanorama = isPanorama;

    this.alpha = 0; // From 0 to 2pi
    this.beta = 0; // From -pi/2 to pi/2

    this.startPosition; // Where the element is when it starts moving
    this.prevPosition;

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
    const eventData = { element: this.element, isCamera: this.isCamera };

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

    if (this.isPanorama) {
      deltaY = 0;
    }

    // Update position relative to cursor speed
    moveEvent.alphaDelta = deltaX / friction;
    moveEvent.betaDelta = deltaY / friction;
    this.alpha = (this.alpha + moveEvent.alphaDelta) % (Math.PI * 2); // Max 360
    this.beta = (this.beta + moveEvent.betaDelta) % (Math.PI * 2); // Max 180

    // Max 90 degrees up and down on pitch  TODO: test
    const ninety = Math.PI / 2;
    if (this.beta > ninety) {
      this.beta = ninety;
    }
    else if (this.beta < -ninety) {
      this.beta = -ninety;
    }

    moveEvent.alpha = this.alpha;
    moveEvent.beta = this.beta;

    // Trigger move event
    this.trigger(moveEvent);
  }

  /**
   * Handle mouse down
   * @param {MouseEvent} event Mouse event.
   */
  handleMouseDown(event) {
    const isLeftClick = event.which === 1;
    if (!isLeftClick) {
      return;
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
      this.move(xDiff, yDiff, this.friction);
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
      event.changedTouches[0].pageX, event.changedTouches[0].pageY, 'touch')
    ) {
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

    this.move(deltaX, deltaY, this.friction * 0.75);
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
    const isArrowKey = [37, 100, 38, 104, 39, 102, 40, 98].includes(event.which);
    if (!isArrowKey) {
      return;
    }

    if (this.keyStillDown === null) {
      // Try to start movement
      if (this.start(0, 0, 'keyboard')) {
        this.keyStillDown = event.which;
        this.element.addEventListener('keyup', this.handleKeyUp, false);
      }
    }

    // Prevent the default behavior
    event.preventDefault();
    event.stopPropagation();

    if (this.keyStillDown !== event.which) {
      return; // Not the same key as we started with
    }

    const delta = {
      x: 0,
      y: 0
    };

    // Update movement in approperiate direction
    switch (event.which) {
      case 37:
      case 100:
        delta.x += this.invert;
        break;
      case 38:
      case 104:
        delta.y += this.invert;
        break;
      case 39:
      case 102:
        delta.x -= this.invert;
        break;
      case 40:
      case 98:
        delta.y -= this.invert;
        break;
    }

    this.move(delta.x, delta.y, this.friction * 0.025);
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

    this.isPanorama = state;
  }
}
