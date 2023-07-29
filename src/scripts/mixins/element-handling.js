import { DEFAULT_ROTATION_ORDER } from '@services/constants';
import PositionControls from '@scripts/position-controls';

/**
 * Mixin containing methods for element handling.
 */
export default class ElementHandling {
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
        this.setElementPosition(threeElement, {
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
    }

    // Set initial position
    this.setElementPosition(threeElement, startPosition);

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
   * Set element's position in the 3d world, always facing the camera.
   * @param {H5P.ThreeJS.CSS3DObject} threeElement CSS3DObject.
   * @param {object} position Position object.
   * @param {number} position.yaw Radians from 0 to Math.PI*2 (0-360).
   * @param {number} position.pitch Radians from -Math.PI/2 to Math.PI/2 (-90-90).
   */
  setElementPosition(threeElement, position) {
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
