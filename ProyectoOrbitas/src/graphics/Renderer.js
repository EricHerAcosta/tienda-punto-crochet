import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Renderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) throw new Error("Contenedor HTML no encontrado para Three.js");

        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        this.camera = new THREE.PerspectiveCamera(45, this.container.clientWidth / this.container.clientHeight, 0.1, 100000);
        this.camera.position.set(0, 150, 300); 
        this.camera.lookAt(0, 0, 0);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.2); 
        const pointLight = new THREE.PointLight(0xffffff, 2.0, 0);
        pointLight.position.set(0, 0, 0);
        this.scene.add(ambientLight);
        this.scene.add(pointLight);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        this.meshes = new Map();
        this.trails = new Map();
        this.predictionsLines = new Map();

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.renderer.domElement.addEventListener('click', this.onMouseClick.bind(this));
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    onMouseClick(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const targetMeshes = Array.from(this.meshes.values());
        const intersects = this.raycaster.intersectObjects(targetMeshes);

        if (intersects.length > 0) {
            const selectedId = intersects[0].object.userData.id;
            window.dispatchEvent(new CustomEvent('body-selected', { detail: { id: selectedId } }));
        } else {
            window.dispatchEvent(new CustomEvent('body-selected', { detail: { id: null } }));
        }
    }

    onWindowResize() {
        if (!this.container) return;
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    render(physicsBodies, predictionsMap = null) {
        const currentBodyIds = new Set(physicsBodies.map(b => b.id));

        for (let id of this.meshes.keys()) {
            if (!currentBodyIds.has(id)) {
                const mesh = this.meshes.get(id);
                this.scene.remove(mesh);
                mesh.geometry.dispose(); mesh.material.dispose();
                this.meshes.delete(id);

                const trail = this.trails.get(id);
                if (trail) {
                    this.scene.remove(trail);
                    trail.geometry.dispose(); trail.material.dispose();
                    this.trails.delete(id);
                }

                const predLine = this.predictionsLines.get(id);
                if (predLine) {
                    this.scene.remove(predLine);
                    predLine.geometry.dispose(); predLine.material.dispose();
                    this.predictionsLines.delete(id);
                }
            }
        }

        for (let body of physicsBodies) {
            if (!this.meshes.has(body.id)) {
                this.createMeshForBody(body);
            }
            const mesh = this.meshes.get(body.id);
            mesh.position.copy(body.position);
            
            this.updateTrailForBody(body);

            // Pintar Predicción Fantasma
            if (predictionsMap && predictionsMap.has(body.id)) {
                const predLine = this.predictionsLines.get(body.id);
                if (predLine) {
                    const arr = predictionsMap.get(body.id);
                    const attr = predLine.geometry.attributes.position;
                    attr.array.set(arr);
                    attr.needsUpdate = true;
                    predLine.geometry.setDrawRange(0, arr.length / 3);
                    predLine.computeLineDistances(); // Requerido p/ LineDashedMaterial en movimiento
                }
            }
        }

        this.controls.update(); 
        this.renderer.render(this.scene, this.camera);
    }

    createMeshForBody(body) {
        const geometry = new THREE.SphereGeometry(body.radius, 32, 32);
        const isStar = body.mass > 500;
        const material = new THREE.MeshStandardMaterial({ 
            color: body.color, roughness: 0.5, metalness: 0.1,
            emissive: isStar ? body.color : '#000000', emissiveIntensity: isStar ? 1.0 : 0
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.id = body.id; 
        this.scene.add(mesh);
        this.meshes.set(body.id, mesh);

        // Estela Histórica Continua
        const trailMaterial = new THREE.LineBasicMaterial({
            color: body.color, transparent: true, opacity: 0.4
        });
        const trailGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(body.maxTrailLength * 3);
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        trailGeometry.setDrawRange(0, 0); 
        const trailLine = new THREE.Line(trailGeometry, trailMaterial);
        this.scene.add(trailLine);
        this.trails.set(body.id, trailLine);

        // Estela de Predicción Punteada
        const predictionMaterial = new THREE.LineDashedMaterial({
            color: body.color,
            linewidth: 1,
            scale: 1,
            dashSize: 3,
            gapSize: 4,
            transparent: true,
            opacity: 0.7 // Mayor opacidad para distinguir el futuro brillando
        });
        const predictionGeometry = new THREE.BufferGeometry();
        const predPositions = new Float32Array(2500 * 3); // Extendido para aceptar la elipse solar completa
        predictionGeometry.setAttribute('position', new THREE.BufferAttribute(predPositions, 3));
        predictionGeometry.setDrawRange(0, 0);

        const predictionLine = new THREE.Line(predictionGeometry, predictionMaterial);
        this.scene.add(predictionLine);
        this.predictionsLines.set(body.id, predictionLine);
    }

    updateTrailForBody(body) {
        const trailLine = this.trails.get(body.id);
        if (!trailLine || body.trail.length === 0) return;

        const positions = trailLine.geometry.attributes.position.array;
        for (let i = 0; i < body.trail.length; i++) {
            const vec = body.trail[i];
            positions[i * 3]     = vec.x;
            positions[i * 3 + 1] = vec.y;
            positions[i * 3 + 2] = vec.z;
        }
        trailLine.geometry.attributes.position.needsUpdate = true;
        trailLine.geometry.setDrawRange(0, body.trail.length);
    }
}
