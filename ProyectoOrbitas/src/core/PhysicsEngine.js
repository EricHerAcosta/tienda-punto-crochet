import * as THREE from 'three';

export class PhysicsEngine {
    constructor(G = 1, softening = 0.1) {
        this.G = G;
        this.softeningSq = softening * softening;
    }

    /**
     * Calcula la aceleración gravitacional experimentada por todos los cuerpos
     * Operación O(n^2) simétrica para maximizar rendimiento
     * @param {Array<Body>} bodies
     * @returns {Map<string, THREE.Vector3>} 
     */
    computeAccelerations(bodies) {
        const accelerations = new Map();
        
        for (let body of bodies) {
            accelerations.set(body.id, new THREE.Vector3(0, 0, 0));
        }

        // Evitar cálculos redundantes. F_12 = -F_21
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                const b1 = bodies[i];
                const b2 = bodies[j];

                const rVector = new THREE.Vector3().subVectors(b2.position, b1.position);
                const distSq = rVector.lengthSq() + this.softeningSq;
                const dist = Math.sqrt(distSq);
                
                // Acceleration: a = G * m / dist^3 * rVec
                const a1_scalar = (this.G * b2.mass) / (distSq * dist);
                const a2_scalar = (this.G * b1.mass) / (distSq * dist);

                accelerations.get(b1.id).addScaledVector(rVector, a1_scalar);
                accelerations.get(b2.id).addScaledVector(rVector, -a2_scalar); // Atracción mutua
            }
        }
        return accelerations;
    }

    /**
     * Integra el sistema 1 paso temporal mediante Velocity-Verlet
     * @param {Array<Body>} bodies
     * @param {number} dt 
     */
    step(bodies, dt) {
        // Paso 1: Posición r(t+dt) = r(t) + v(t)dt + 0.5 * a(t) * dt^2
        for (let body of bodies) {
            body.position.addScaledVector(body.velocity, dt);
            body.position.addScaledVector(body.acceleration, 0.5 * dt * dt);
        }

        // Paso 2: Calcular nuevas aceleraciones a(t+dt) en la nueva posición
        const newAccelerations = this.computeAccelerations(bodies);

        // Paso 3: Actualizar Velocidades v(t+dt) = v(t) + 0.5 * (a(t) + a(t+dt)) * dt
        for (let body of bodies) {
            const a_t = body.acceleration;
            const a_next = newAccelerations.get(body.id);
            
            const avgAccel = new THREE.Vector3().addVectors(a_t, a_next).multiplyScalar(0.5);
            body.velocity.addScaledVector(avgAccel, dt);
            
            // Reemplazar aceleración antigua con la nueva p/ la sig iteración
            body.acceleration.copy(a_next);
        }
    }

    /**
     * Detección de colisiones (distancia < suma de radios) y Fusión Perfectamente Inelástica
     * @param {Array<Body>} bodies 
     * @returns {Array<Body>}
     */
    handleCollisions(bodies) {
        let hasCollision = false;
        const toMerge = [];
        
        for (let i = 0; i < bodies.length; i++) {
            if (bodies[i]._merged) continue;
            for (let j = i + 1; j < bodies.length; j++) {
                if (bodies[j]._merged) continue;
                
                const b1 = bodies[i];
                const b2 = bodies[j];
                const distSq = b1.position.distanceToSquared(b2.position);
                const radSum = b1.radius + b2.radius;
                
                if (distSq <= radSum * radSum) {
                    toMerge.push([b1, b2]);
                    b1._merged = true;
                    b2._merged = true;
                    hasCollision = true;
                    break; 
                }
            }
        }

        if (!hasCollision) return bodies;

        const newBodies = bodies.filter(b => !b._merged);
        
        for (let pair of toMerge) {
            const [b1, b2] = pair;
            const newMass = b1.mass + b2.mass;
            
            // Conservar momento: v_f = (p1+p2)/m_f
            const p1 = b1.velocity.clone().multiplyScalar(b1.mass);
            const p2 = b2.velocity.clone().multiplyScalar(b2.mass);
            const newVel = p1.add(p2).divideScalar(newMass);
            
            // Posición (Centro de Masa)
            const pos1 = b1.position.clone().multiplyScalar(b1.mass);
            const pos2 = b2.position.clone().multiplyScalar(b2.mass);
            const newPos = pos1.add(pos2).divideScalar(newMass);
            
            // Volumen se suma: r_f = cbrt(r1^3 + r2^3)
            const newRadius = Math.cbrt(Math.pow(b1.radius, 3) + Math.pow(b2.radius, 3));
            
            const dominantColor = b1.mass >= b2.mass ? b1.color : b2.color;
            const newBody = new b1.constructor(
                `${b1.id}_${b2.id}_fusion`,
                newMass,
                newPos,
                newVel,
                newRadius,
                dominantColor
            );
            
            newBodies.push(newBody);
        }

        newBodies.forEach(b => delete b._merged);
        return newBodies;
    }
}
