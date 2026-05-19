import * as THREE from 'three';
import { Body } from '../core/Body.js';

export class UIManager {
    constructor(controller) {
        this.controller = controller;
        this.selectedBodyId = null;
        this.editingBodyId = null; // Rastrea si modal está editando un Astro Existente

        // Constantes del tiempo de la bóveda terrestre
        // Con G=1, M=1000, 1 AU=100, el periodo terrestre T=198.69 u.sim // 365 días
        this.YEAR_CONST = 198.69;
        this.DAY_CONST = this.YEAR_CONST / 365.25;

        this.initHUD();
        this.initModal();
        this.initTelemetry();
    }

    initHUD() {
        document.getElementById('btn-play').addEventListener('click', () => this.controller.start());
        document.getElementById('btn-pause').addEventListener('click', () => this.controller.pause());
        document.getElementById('btn-reset').addEventListener('click', () => {
             this.controller.reset();
             window.dispatchEvent(new Event('gravitylab-reset'));
        });

        const timeSlider = document.getElementById('slider-time');
        const timeVal = document.getElementById('val-time');
        
        timeSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.controller.setTimeScale(val);
            timeVal.innerText = val.toFixed(1) + 'x';
        });

        const togglePredict = document.getElementById('toggle-predict');
        togglePredict.addEventListener('change', (e) => {
            this.controller.showPredictions = (e.target.value === 'true');
            if(!this.controller.running) this.controller.drawInstantPredict();
        });
    }

    initModal() {
        const modal = document.getElementById('modal-create');
        
        // Modal Crear Nuevo
        document.getElementById('btn-open-modal').addEventListener('click', () => {
            this.editingBodyId = null;
            document.getElementById('modal-title').innerText = "Forjar Astro Cero";
            document.getElementById('btn-confirm-modal').innerText = "Inyectar Sistema";
            modal.style.display = 'flex';
        });

        // Modal de Edición desde el Inspector
        document.getElementById('btn-edit-body').addEventListener('click', () => {
            if (!this.selectedBodyId) return;
            const body = this.controller.simulation.bodies.find(b => b.id === this.selectedBodyId);
            if (!body) return;

            this.editingBodyId = this.selectedBodyId;
            document.getElementById('modal-title').innerText = "Modificar " + body.id;
            document.getElementById('btn-confirm-modal').innerText = "Hacer Evolucionar Parámetros";

            // Precargar DOM sliders
            const e = (id, val) => {
                const el = document.getElementById(id);
                el.value = val;
                el.dispatchEvent(new Event('input')); // Forzar actualización visual label
            };
            e('in-mass', body.mass);
            e('in-px', body.position.x); e('in-py', body.position.y); e('in-pz', body.position.z);
            e('in-vx', body.velocity.x); e('in-vy', body.velocity.y); e('in-vz', body.velocity.z);
            e('in-color', body.color);

            modal.style.display = 'flex';
        });


        document.getElementById('btn-cancel-modal').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        const binds = [
            { id: 'in-mass', out: 'val-mass' },
            { id: 'in-px', out: 'val-px' }, { id: 'in-py', out: 'val-py' }, { id: 'in-pz', out: 'val-pz' },
            { id: 'in-vx', out: 'val-vx' }, { id: 'in-vy', out: 'val-vy' }, { id: 'in-vz', out: 'val-vz' }
        ];
        binds.forEach(b => {
            const input = document.getElementById(b.id);
            const output = document.getElementById(b.out);
            input.addEventListener('input', (e) => output.innerText = e.target.value);
        });

        document.getElementById('btn-confirm-modal').addEventListener('click', () => {
            this.createOrEditBodyFromForm();
            modal.style.display = 'none';
        });
    }

    initTelemetry() {
        window.addEventListener('body-selected', (e) => {
            this.selectedBodyId = e.detail.id;
            const inspector = document.getElementById('inspector-panel');
            const msg = document.getElementById('inspector-msg');

            if (this.selectedBodyId) {
                inspector.style.display = 'block';
                msg.style.display = 'none';
            } else {
                inspector.style.display = 'none';
                msg.style.display = 'block';
            }
        });

        const uiLoop = () => {
            this.updateTelemetryPanels();
            requestAnimationFrame(uiLoop);
        };
        requestAnimationFrame(uiLoop);
    }

    updateTelemetryPanels() {
        const sim = this.controller.simulation;
        sim.calculateMetrics();
        const m = sim.metrics;

        // Cronómetro Astronómico Escalado a Sistema Solar base Local
        if (sim.elapsedTime > 0) {
           const years = Math.floor(sim.elapsedTime / this.YEAR_CONST);
           const days = Math.floor((sim.elapsedTime % this.YEAR_CONST) / this.DAY_CONST);
           document.getElementById('time-indicator').innerText = `Año ${years}, Día ${days}`;
        }

        document.getElementById('kin-e').innerText = m.kineticEnergy.toExponential(3);
        document.getElementById('pot-e').innerText = m.potentialEnergy.toExponential(3);
        document.getElementById('tot-e').innerText = m.totalEnergy.toExponential(3);
        document.getElementById('ang-m').innerText = m.angularMomentum.toExponential(3);

        if (this.selectedBodyId) {
            const body = sim.bodies.find(b => b.id === this.selectedBodyId);
            if (body) {
                document.getElementById('ins-name').innerText = body.id;
                document.getElementById('ins-mass').innerText = body.mass.toFixed(1);
                document.getElementById('ins-vel').innerText  = body.velocity.length().toFixed(3);
                document.getElementById('ins-pos').innerText  = 
                    `(${body.position.x.toFixed(0)}, ${body.position.y.toFixed(0)}, ${body.position.z.toFixed(0)})`;
            } else {
                this.selectedBodyId = null;
                document.getElementById('inspector-panel').style.display = 'none';
                document.getElementById('inspector-msg').style.display = 'block';
            }
        }
    }

    createOrEditBodyFromForm() {
        const mass = parseFloat(document.getElementById('in-mass').value);
        const px = parseFloat(document.getElementById('in-px').value);
        const py = parseFloat(document.getElementById('in-py').value);
        const pz = parseFloat(document.getElementById('in-pz').value);
        
        const vx = parseFloat(document.getElementById('in-vx').value);
        const vy = parseFloat(document.getElementById('in-vy').value);
        const vz = parseFloat(document.getElementById('in-vz').value);
        
        const color = document.getElementById('in-color').value;

        const pos = new THREE.Vector3(px, py, pz);
        const vel = new THREE.Vector3(vx, vy, vz);
        const autoRadius = Math.cbrt(mass);
        
        if (this.editingBodyId) {
             const cuerpoBuscado = this.controller.simulation.bodies.find(b => b.id === this.editingBodyId);
             if(cuerpoBuscado) {
                 cuerpoBuscado.mass = mass;
                 cuerpoBuscado.position.copy(pos);
                 cuerpoBuscado.velocity.copy(vel);
                 cuerpoBuscado.color = color;
                 cuerpoBuscado.radius = autoRadius;
                 cuerpoBuscado.trail = []; // Estela vieja a cero al moverse milagrosamente
             }
             this.controller.simulation.initializeAccelerations(); // Recalcular O(n2)
             if(!this.controller.running) this.controller.drawInstantPredict();
        } else {
             const name = "Planeta_" + Math.floor(Math.random() * 1000);
             const newBody = new Body(name, mass, pos, vel, autoRadius, color);
             this.controller.addBody(newBody);
        }
    }
}
