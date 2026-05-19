import { Simulation } from './Simulation.js';
import { Renderer } from '../graphics/Renderer.js';

export class SimulationController {
    constructor(containerId) {
        this.simulation = new Simulation();
        this.renderer = new Renderer(containerId);
        
        this.lastTime = 0;
        this.animationFrameId = null;
        this.running = false;
        
        this.showPredictions = true;
        this.loop = this.loop.bind(this);
    }

    addBody(body) {
        this.simulation.addBody(body);
        this.drawInstantPredict();
    }

    removeBody(id) {
        this.simulation.removeBody(id);
        this.drawInstantPredict();
    }

    drawInstantPredict() {
        if (this.showPredictions) {
            const predictions = this.simulation.predictTrajectories(2500, 0.8);
            this.renderer.render(this.simulation.bodies, predictions);
        } else {
            this.renderer.render(this.simulation.bodies, null);
        }
    }

    start() {
        if (this.running) return;
        this.simulation.play();
        this.running = true;
        this.lastTime = performance.now();
        this.loop(this.lastTime);
    }

    pause() {
        this.running = false;
        this.simulation.pause();
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    setTimeScale(scale) {
        this.simulation.timeScale = scale;
    }

    reset() {
        this.pause();
        this.simulation.reset();
        this.renderer.render(this.simulation.bodies, null);
    }

    loop(time) {
        if (!this.running) return;

        this.animationFrameId = requestAnimationFrame(this.loop);

        const rawDt = (time - this.lastTime) / 1000;
        this.lastTime = time;
        const safeDt = Math.min(rawDt, 0.1); 

        this.simulation.update(safeDt);
        
        if (this.showPredictions) {
            // Proyección elipsa cerrada: 2500 iteraciones a 0.8 de separación. Equivale ~a orbitar Saturno
            const predictions = this.simulation.predictTrajectories(2500, 0.8);
            this.renderer.render(this.simulation.bodies, predictions);
        } else {
            this.renderer.render(this.simulation.bodies, null);
        }
    }
    
    get state() {
        return {
            bodies: this.simulation.bodies,
            timeScale: this.simulation.timeScale,
            isRunning: this.running
        };
    }
}
