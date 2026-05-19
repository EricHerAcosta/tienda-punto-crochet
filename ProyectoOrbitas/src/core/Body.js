import * as THREE from 'three';

export class Body {
    /**
     * @param {string} id - Identificador único
     * @param {number} mass - Masa del cuerpo
     * @param {THREE.Vector3} position - Posición inicial (x,y,z)
     * @param {THREE.Vector3} velocity - Velocidad inicial (vx,vy,vz)
     * @param {number} [radius] - Radio del cuerpo (opcional, calculado de la masa si no se provee)
     * @param {string} [color] - Color (hex o rgb)
     */
    constructor(id, mass, position, velocity, radius = null, color = '#ffffff') {
        this.id = id;
        this.mass = mass;
        this.position = position.clone();
        this.velocity = velocity.clone();
        
        // Aceleración utilizada para la integración Velocity-Verlet
        this.acceleration = new THREE.Vector3(0, 0, 0);

        // Densidad asumida = 1 para autocalcular el radio si falta
        this.radius = radius !== null ? radius : Math.cbrt(mass);
        this.color = color;

        // Historial para las estelas (tails)
        this.trail = [];
        this.maxTrailLength = 200; // Previene Memory Leaks
    }

    /**
     * Registra la posición actual en la estela
     */
    updateTrail() {
        if (this.trail.length >= this.maxTrailLength) {
            this.trail.shift(); // Elimina el más antiguo (FIFO)
        }
        this.trail.push(this.position.clone());
    }
}
