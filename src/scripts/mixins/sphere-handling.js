import { DEFAULT_WORLD_RADIUS } from '@services/constants';

/**
 * Mixin containing methods for sphere handling.
 */
export default class SphereHandling {
  /**
   * Create the world sphere with its needed resources.
   */
  createSphere() {
    // Create a sphere surrounding the camera with the source texture
    const geometry = new H5P.ThreeJS.SphereGeometry(
      DEFAULT_WORLD_RADIUS, this.options.segments, this.options.segments
    );

    this.applyToSphere(geometry);
  }

  /**
   * Create the world cylinder with its needed resources.
   */
  createCylinder() {
    // Create a cylinder surrounding the camera with the source texture
    const geometry = new H5P.ThreeJS.CylinderGeometry(
      DEFAULT_WORLD_RADIUS, DEFAULT_WORLD_RADIUS, DEFAULT_WORLD_RADIUS,
      this.options.segments, this.options.segments,
      true
    );

    this.applyToSphere(geometry);
  }

  /**
   * Apply geometry to sphere.
   * @param {H5P.ThreeJS.SphereGeometry|H5P.ThreeJS.CylinderGeometry} geometry Geometry.
   */
  applyToSphere(geometry) {
    geometry.scale(-1, 1, 1); // Flip to make front side face inwards

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

    // Prepare sphere/cylinder and add to scene
    this.sphere = new H5P.ThreeJS.Mesh(geometry, material);

    this.scene.add(this.sphere);
  }

  /**
   * Remove sphere resources from memory.
   */
  disposeSphere() {
    this.scene.remove(this.sphere);

    this.sphere.geometry.dispose();
    this.sphere.material.dispose();
    this.sphere.material.map.dispose();
    this.sphere = null;
  }
}
