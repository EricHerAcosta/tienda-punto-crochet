import { PhysicsEngine } from './PhysicsEngine.js';
import * as THREE from 'three';

export class Simulation {
    constructor() {
        this.bodies = [];
        this.timeScale = 1; 
        this.isRunning = false;
        this.elapsedTime = 0; // en unidades simuladas
        this.physics = new PhysicsEngine(1, 0.1);
        this.metrics = {
            kineticEnergy: 0, potentialEnergy: 0, totalEnergy: 0, angularMomentum: 0
        };
    }

    addBody(body) {
        // Expandido para acomodar planetas solares mas lunas y cometas (ej. 20)
        if (this.bodies.length >= 20) { console.warn("Límite máximo de 20"); return; }
        this.bodies.push(body);
        this.initializeAccelerations();
    }

    removeBody(id) {
        this.bodies = this.bodies.filter(b => b.id !== id);
        this.initializeAccelerations();
    }

    initializeAccelerations() {
        if (this.bodies.length === 0) return;
        const initialAccels = this.physics.computeAccelerations(this.bodies);
        for (let body of this.bodies) {
            body.acceleration.copy(initialAccels.get(body.id));
        }
    }

    play() { this.isRunning = true; }
    pause() { this.isRunning = false; }
    
    reset() {
        this.bodies = [];
        this.physics = new PhysicsEngine(1, 0.1);
        this.timeScale = 1;
        this.elapsedTime = 0;
        this.isRunning = false;
    }

    calculateMetrics() {
        let Ek = 0; let Ep = 0; let L = new THREE.Vector3();
        for (let i = 0; i < this.bodies.length; i++) {
            const b1 = this.bodies[i];
            Ek += 0.5 * b1.mass * b1.velocity.lengthSq();
            const momVec = b1.velocity.clone().multiplyScalar(b1.mass);
            const angularMomentumVec = new THREE.Vector3().crossVectors(b1.position, momVec);
            L.add(angularMomentumVec);
            for (let j = i + 1; j < this.bodies.length; j++) {
                const b2 = this.bodies[j];
                const distSq = b1.position.distanceToSquared(b2.position);
                if (distSq > 0) Ep -= (this.physics.G * b1.mass * b2.mass) / Math.sqrt(distSq);
            }
        }
        this.metrics.kineticEnergy = Ek;
        this.metrics.potentialEnergy = Ep;
        this.metrics.totalEnergy = Ek + Ep; 
        this.metrics.angularMomentum = L.length(); 
    }

    update(baseDt) {
        if (!this.isRunning || this.bodies.length === 0) return;
        const dt = baseDt * this.timeScale;
        this.elapsedTime += dt;
        
        const subSteps = 4; 
        const internalDt = dt / subSteps;
        for (let i = 0; i < subSteps; i++) {
            this.physics.step(this.bodies, internalDt);
            this.bodies = this.physics.handleCollisions(this.bodies);
        }
        for (let body of this.bodies) {
            body.updateTrail();
        }
    }

    /**
     * Predice elipses completas proyectando 2500 iteraciones en el vacio
     */
    predictTrajectories(steps = 2500, predictDt = 0.8) {
        if (this.bodies.length === 0) return null;

        const phantomBodies = this.bodies.map(b => {
             const phantom = new b.constructor(b.id, b.mass, b.position, b.velocity, b.radius, b.color);
             phantom.acceleration.copy(b.acceleration);
             return phantom;
        });

        const predictions = new Map();
        for (let b of phantomBodies) {
            predictions.set(b.id, new Float32Array(steps * 3));
        }

        for (let step = 0; step < steps; step++) {
            this.physics.step(phantomBodies, predictDt);
            for (let b of phantomBodies) {
                const arr = predictions.get(b.id);
                arr[step * 3]     = b.position.x;
                arr[step * 3 + 1] = b.position.y;
                arr[step * 3 + 2] = b.position.z;
            }
        }
        
        return predictions;
    }
}
