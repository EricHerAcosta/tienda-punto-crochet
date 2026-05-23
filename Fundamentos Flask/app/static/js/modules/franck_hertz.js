/**
 * Módulo del Experimento de Franck-Hertz
 * Simulación interactiva con física simplificada y renderizado optimizado a 60 FPS
 */

document.addEventListener("DOMContentLoaded", () => {
    // === CONFIGURACIÓN DE LOS GASES ===
    const GAS_DATABASE = {
        hg: {
            name: "Mercurio (Hg)",
            excitationEnergy: 4.9, // eV
            colorGlow: "rgba(129, 140, 248, 0.05)", // Indigo tenue
            colorBand: "rgba(99, 102, 241, 0.35)",  // Indigo brillante
            colorCollision: "#818cf8",              // Color de destello
            colorChart: "#818cf8",
            wavelength: "253.7 nm (UV)"
        },
        ne: {
            name: "Neón (Ne)",
            excitationEnergy: 18.9, // eV
            colorGlow: "rgba(249, 115, 22, 0.05)",  // Naranja tenue
            colorBand: "rgba(249, 115, 22, 0.45)",  // Naranja brillante
            colorCollision: "#f97316",              // Color de destello
            colorChart: "#f97316",
            wavelength: "585.2 nm (Naranja-Rojo)"
        },
        ar: {
            name: "Argón (Ar)",
            excitationEnergy: 11.5, // eV
            colorGlow: "rgba(34, 211, 238, 0.05)",  // Cian tenue
            colorBand: "rgba(6, 182, 212, 0.35)",   // Cian brillante
            colorCollision: "#22d3ee",              // Color de destello
            colorChart: "#22d3ee",
            wavelength: "696.5 nm (Cian/Infrarrojo)"
        }
    };

    // === ELEMENTOS DEL DOM ===
    const gasSelect = document.getElementById("gas-select");
    const voltajeSlider = document.getElementById("voltaje-slider");
    const voltajeNum = document.getElementById("voltaje-num");
    const densidadSlider = document.getElementById("densidad-slider");
    const densidadNum = document.getElementById("densidad-num");
    const realismoSlider = document.getElementById("realismo-slider");
    
    const btnSweep = document.getElementById("btn-sweep");
    const btnTutorial = document.getElementById("btn-tutorial");
    const btnExample1 = document.getElementById("btn-example1");
    const btnExample2 = document.getElementById("btn-example2");
    
    // Modals
    const tutorialModal = document.getElementById("tutorial-modal");
    const closeTutorial = document.getElementById("close-tutorial");
    
    const exampleModal = document.getElementById("example-modal");
    const closeExample = document.getElementById("close-example");
    const exampleTitle = document.getElementById("example-title");
    const exampleBody = document.getElementById("example-body");
    
    const infoFhModal = document.getElementById("info-fh-modal");
    const closeInfoFh = document.getElementById("close-info-fh");
    const btnInfoFh = document.getElementById("btn-info-fh");

    const infoTubeModal = document.getElementById("info-tube-modal");
    const closeInfoTube = document.getElementById("close-info-tube");
    const btnInfoTube = document.getElementById("btn-info-tube");

    // Telemetría
    const tGas = document.getElementById("t-gas");
    const tEnergia = document.getElementById("t-energia");
    const tVoltaje = document.getElementById("t-voltaje");
    const tCorriente = document.getElementById("t-corriente");
    const tColisiones = document.getElementById("t-colisiones");

    // Canvas
    const canvas = document.getElementById("physics-canvas");
    const ctx = canvas.getContext("2d");

    // === ESTADOS DE LA SIMULACIÓN ===
    let currentGasKey = "hg";
    let voltajeAcelerador = 15.0; // V
    let densidadGas = 1.0;
    let realismo = 0.5; // 0 = conceptual, 1 = realista
    
    let sweepInterval = null;
    let isSweeping = false;
    let particles = [];
    let collisionEffects = [];
    let lightWaves = [];
    const retardingPotential = 1.5; // V

    // === CÁLCULO DE COORDENADAS DINÁMICAS (Para evitar distorsión) ===
    function getLayout() {
        // Obtenemos el tamaño real renderizado del contenedor
        const rect = canvas.parentElement.getBoundingClientRect();
        const width = Math.round(rect.width);
        const height = Math.round(rect.height);
        
        // Ajustamos la resolución interna del canvas si cambia significativamente (> 2px)
        if (Math.abs(canvas.width - width) > 2 || Math.abs(canvas.height - height) > 2) {
            canvas.width = width;
            canvas.height = height;
        }

        const tubeWidth = canvas.width * 0.8;
        const tubeHeight = canvas.height * 0.58;
        const tubeX = (canvas.width - tubeWidth) / 2;
        const tubeY = (canvas.height - tubeHeight) / 2;

        return {
            tubeX: tubeX,
            tubeY: tubeY,
            tubeWidth: tubeWidth,
            tubeHeight: tubeHeight,
            gridX: tubeX + tubeWidth * 0.9,
            collectorX: tubeX + tubeWidth
        };
    }

    // === INICIALIZACIÓN DE CHART.JS ===
    const chartCtx = document.getElementById("chart-fh").getContext("2d");
    let fhChart = new Chart(chartCtx, {
        type: "line",
        data: {
            labels: [],
            datasets: [{
                label: "Corriente Colectora (Ic)",
                data: [],
                borderColor: GAS_DATABASE[currentGasKey].colorChart,
                backgroundColor: "rgba(255,255,255,0.01)",
                borderWidth: 3,
                tension: 0.35,
                pointRadius: (context) => {
                    const index = context.dataIndex;
                    const value = context.dataset.data[index];
                    if (value && Math.abs(value.x - voltajeAcelerador) < 0.3) {
                        return 6;
                    }
                    return 0;
                },
                pointBackgroundColor: (context) => {
                    return GAS_DATABASE[currentGasKey].colorChart;
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: "linear",
                    title: { display: true, text: "Voltaje Acelerador Va (V)", color: "#94a3b8" },
                    min: 0,
                    max: 60,
                    ticks: { color: "#94a3b8" },
                    grid: { color: "rgba(255,255,255,0.05)" }
                },
                y: {
                    title: { display: true, text: "Corriente (u.a.)", color: "#94a3b8" },
                    min: 0,
                    max: 110,
                    ticks: { color: "#94a3b8" },
                    grid: { color: "rgba(255,255,255,0.05)" }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });

    // === CÁLCULO ANALÍTICO DE LA CURVA ===
    function calculateCurrent(v, gasKey, dens, real) {
        if (v < retardingPotential) return 0;
        
        const gas = GAS_DATABASE[gasKey];
        const Eex = gas.excitationEnergy;
        
        // Corriente base que aumenta con el voltaje (espacio-carga)
        const baseCurrent = 90 * Math.pow(v / 60, 1.25);
        const vContact = 1.2; 
        let dipSum = 0;
        
        const maxCollisions = Math.floor(60 / Eex) + 1;
        for (let n = 1; n <= maxCollisions; n++) {
            const center = n * Eex + vContact;
            const width = (0.3 + 2.8 * real) * Math.sqrt(n); 
            const amplitude = Math.min(0.88, 0.72 * dens);
            
            dipSum += amplitude * Math.exp(-Math.pow(v - center, 2) / (2 * Math.pow(width, 2)));
        }
        
        let current = baseCurrent * (1 - Math.min(0.9, dipSum));
        
        if (real > 0.05) {
            const noiseAmp = 0.6 * real * Math.sqrt(current);
            current += (Math.random() - 0.5) * noiseAmp;
        }
        
        return Math.max(0.1, current);
    }

    function drawFullCurve() {
        const points = [];
        const step = 0.5;
        for (let v = 0; v <= 60; v += step) {
            points.push({ x: v, y: calculateCurrent(v, currentGasKey, densidadGas, realismo) });
        }
        
        fhChart.data.datasets[0].data = points;
        fhChart.data.datasets[0].borderColor = GAS_DATABASE[currentGasKey].colorChart;
        fhChart.update();
    }

    // === CLASE ELECTRÓN OPTIMIZADA ===
    class Electron {
        constructor(startDistributed = false) {
            this.reset();
            if (startDistributed) {
                const layout = getLayout();
                this.x = layout.tubeX + Math.random() * (layout.gridX - layout.tubeX) * 0.8;
                this.energy = voltajeAcelerador * ((this.x - layout.tubeX) / (layout.gridX - layout.tubeX));
            }
        }

        reset() {
            const layout = getLayout();
            this.x = layout.tubeX;
            this.y = layout.tubeY + 15 + Math.random() * (layout.tubeHeight - 30);
            this.vx = 0.2;
            this.vy = (Math.random() - 0.5) * 0.15;
            this.energy = 0.1; // Energía térmica inicial
            this.dead = false;
        }

        update(layout) {
            if (this.dead) return;

            const gas = GAS_DATABASE[currentGasKey];
            const Eex = gas.excitationEnergy;
            const C_sq = 0.12; // Constante que relaciona energía cinética (eV) con velocidad^2 (px^2/frame^2)

            // 1. Aceleración / Desaceleración por campo eléctrico
            if (this.x < layout.gridX) {
                const D_acc = layout.gridX - layout.tubeX;
                const field = voltajeAcelerador / D_acc;
                
                // Trabajo realizado: dE = F * dx
                const dEnergy = field * this.vx;
                this.energy += dEnergy;
                
                // Relación física: vx = sqrt(C_sq * energy - vy^2)
                const speedSq = C_sq * this.energy;
                this.vx = Math.sqrt(Math.max(0.04, speedSq - this.vy * this.vy));
            } else if (this.x >= layout.gridX && this.x < layout.collectorX) {
                const D_ret = layout.collectorX - layout.gridX;
                
                // Trabajo en contra del potencial retardador
                const dEnergy = -(retardingPotential / D_ret) * this.vx;
                this.energy = Math.max(0, this.energy + dEnergy);
                
                const speedSq = C_sq * this.energy;
                const calculatedVx = speedSq - this.vy * this.vy;
                
                if (calculatedVx <= 0.0025) {
                    this.dead = true;
                    return;
                } else {
                    this.vx = Math.sqrt(calculatedVx);
                }
            }

            // 2. Colisión Inelástica
            if (this.x < layout.gridX && this.energy >= Eex) {
                let collisionProb = 1.0;
                if (realismo > 0.05) {
                    collisionProb = 1.0 - Math.exp(-densidadGas * (this.energy - Eex) * 2.0);
                }

                if (Math.random() < collisionProb) {
                    // Pérdida discreta de energía
                    this.energy = Math.max(0, this.energy - Eex);
                    
                    // Colisión inelástica: velocidad reducida y dispersión angular
                    const speed = Math.sqrt(C_sq * this.energy);
                    
                    if (realismo > 0.1) {
                        const angle = (Math.random() - 0.5) * realismo * Math.PI * 0.5;
                        this.vx = Math.max(0.15, speed * Math.cos(angle));
                        this.vy = speed * Math.sin(angle);
                    } else {
                        this.vx = Math.max(0.15, speed);
                        this.vy = 0;
                    }

                    // Destello luminoso en el punto de colisión
                    collisionEffects.push({
                        x: this.x,
                        y: this.y,
                        radius: 2,
                        maxRadius: 10 + Math.random() * 6,
                        alpha: 1.0,
                        color: gas.colorCollision
                    });

                    // Emisión de fotón
                    if (Math.random() < 0.5) {
                        lightWaves.push({
                            x: this.x,
                            y: this.y,
                            vx: (Math.random() - 0.5) * 0.8,
                            vy: -1.2 - Math.random() * 0.8,
                            alpha: 1.0,
                            color: gas.colorCollision
                        });
                    }
                }
            }

            this.x += this.vx;
            this.y += this.vy;

            // Límites del tubo
            if (this.y < layout.tubeY + 5) {
                this.y = layout.tubeY + 5;
                this.vy = -this.vy * 0.5;
            }
            if (this.y > layout.tubeY + layout.tubeHeight - 5) {
                this.y = layout.tubeY + layout.tubeHeight - 5;
                this.vy = -this.vy * 0.5;
            }

            // Colector
            if (this.x >= layout.collectorX) {
                if (this.energy >= 0.01 && this.vx > 0) {
                    this.dead = true;
                } else {
                    this.vx = -0.2;
                    this.vy = (Math.random() - 0.5) * 0.4;
                    if (this.x > layout.collectorX + 10 || this.x < layout.gridX) {
                        this.dead = true;
                    }
                }
            }
        }

        draw() {
            if (this.dead) return;

            // Renderizado optimizado sin usar shadowBlur
            ctx.fillStyle = "rgba(34, 211, 238, 0.25)";
            ctx.beginPath();
            ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#e0f7fa";
            ctx.beginPath();
            ctx.arc(this.x, this.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // === ANIMATE LOOP ===
    function animate() {
        // Calcular layout real ajustado
        const layout = getLayout();
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const gas = GAS_DATABASE[currentGasKey];

        // 1. Dibujar el Tubo de Vidrio
        ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
        ctx.lineWidth = 2;
        ctx.fillStyle = "rgba(15, 23, 42, 0.45)";
        
        ctx.beginPath();
        ctx.roundRect(layout.tubeX, layout.tubeY, layout.tubeWidth, layout.tubeHeight, 15);
        ctx.fill();
        ctx.stroke();

        // Glow interno del gas
        ctx.fillStyle = gas.colorGlow;
        ctx.beginPath();
        ctx.roundRect(layout.tubeX + 5, layout.tubeY + 5, layout.tubeWidth - 10, layout.tubeHeight - 10, 10);
        ctx.fill();

        // 2. Dibujar Cátodo
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(layout.tubeX + 15, layout.tubeY + 30);
        ctx.lineTo(layout.tubeX + 15, layout.tubeY + layout.tubeHeight - 30);
        ctx.stroke();
        
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(layout.tubeX + 15, layout.tubeY + 30);
        ctx.lineTo(layout.tubeX - 20, layout.tubeY + 30);
        ctx.moveTo(layout.tubeX + 15, layout.tubeY + layout.tubeHeight - 30);
        ctx.lineTo(layout.tubeX - 20, layout.tubeY + layout.tubeHeight - 30);
        ctx.stroke();

        // Rejilla Aceleradora (Grid)
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(layout.gridX, layout.tubeY + 10);
        ctx.lineTo(layout.gridX, layout.tubeY + layout.tubeHeight - 10);
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash

        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.beginPath();
        ctx.moveTo(layout.gridX, layout.tubeY + 10);
        ctx.lineTo(layout.gridX, layout.tubeY - 20);
        ctx.stroke();

        // Colector
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(layout.collectorX - 10, layout.tubeY + 25);
        ctx.lineTo(layout.collectorX - 10, layout.tubeY + layout.tubeHeight - 25);
        ctx.stroke();
        
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(layout.collectorX - 10, layout.tubeY + layout.tubeHeight / 2);
        ctx.lineTo(layout.collectorX + 30, layout.tubeY + layout.tubeHeight / 2);
        ctx.stroke();

        // Textos del montaje (nítidos, sin estiramiento)
        ctx.fillStyle = "#94a3b8";
        ctx.font = "12px Inter, sans-serif";
        ctx.fillText("Cátodo (K)", layout.tubeX - 10, layout.tubeY + 20);
        ctx.fillText("Rejilla (G)", layout.gridX - 30, layout.tubeY + 5);
        ctx.fillText("Colector (A)", layout.collectorX - 20, layout.tubeY + 20);

        // 3. Dibujar Bandas de Excitación
        if (voltajeAcelerador > gas.excitationEnergy) {
            const numBands = Math.floor(voltajeAcelerador / gas.excitationEnergy);
            
            for (let i = 1; i <= numBands; i++) {
                const bandPosFract = (i * gas.excitationEnergy) / voltajeAcelerador;
                const bandX = layout.tubeX + (layout.gridX - layout.tubeX) * bandPosFract;
                
                const grad = ctx.createLinearGradient(bandX - 20, 0, bandX + 20, 0);
                grad.addColorStop(0, "rgba(255,255,255,0)");
                grad.addColorStop(0.5, gas.colorBand);
                grad.addColorStop(1, "rgba(255,255,255,0)");
                
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.rect(bandX - 25, layout.tubeY + 5, 50, layout.tubeHeight - 10);
                ctx.fill();

                ctx.strokeStyle = "rgba(255,255,255,0.12)";
                ctx.beginPath();
                ctx.moveTo(bandX, layout.tubeY + 5);
                ctx.lineTo(bandX, layout.tubeY + layout.tubeHeight - 5);
                ctx.stroke();
            }
        }

        // 4. Actualizar población de electrones (optimizado y menos denso)
        const targetCount = Math.floor(12 + densidadGas * 8);
        while (particles.length < targetCount) {
            // Si la lista está totalmente vacía (inicio), distribuir los electrones a lo largo del tubo
            const startDistributed = (particles.length === 0);
            if (startDistributed) {
                for (let i = 0; i < targetCount; i++) {
                    particles.push(new Electron(true));
                }
            } else {
                particles.push(new Electron(false));
            }
        }

        particles.forEach((p, idx) => {
            p.update(layout);
            p.draw();
            if (p.dead) {
                particles[idx] = new Electron(false); // Nace en el cátodo
            }
        });

        // 5. Destellos de Colisión
        collisionEffects.forEach((eff, idx) => {
            eff.radius += 0.4;
            eff.alpha -= 0.05;
            
            if (eff.alpha <= 0) {
                collisionEffects.splice(idx, 1);
                return;
            }

            ctx.strokeStyle = eff.color;
            ctx.globalAlpha = eff.alpha;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(eff.x, eff.y, eff.radius, 0, Math.PI * 2);
            ctx.stroke();
        });
        ctx.globalAlpha = 1.0;

        // 6. Ondas de Luz
        lightWaves.forEach((w, idx) => {
            w.x += w.vx;
            w.y += w.vy;
            w.alpha -= 0.025;

            if (w.alpha <= 0 || w.y < layout.tubeY + 10) {
                lightWaves.splice(idx, 1);
                return;
            }

            ctx.strokeStyle = w.color;
            ctx.globalAlpha = w.alpha;
            ctx.lineWidth = 1;
            
            ctx.beginPath();
            for (let i = -4; i <= 4; i++) {
                const wx = w.x + i;
                const wy = w.y + Math.sin(i * 1.5) * 2;
                if (i === -4) ctx.moveTo(wx, wy);
                else ctx.lineTo(wx, wy);
            }
            ctx.stroke();
        });
        ctx.globalAlpha = 1.0;

        requestAnimationFrame(animate);
    }

    // === ACTUALIZAR TELEMETRÍA Y CONTROLES ===
    function updateTelemetry() {
        const gas = GAS_DATABASE[currentGasKey];
        const currentI = calculateCurrent(voltajeAcelerador, currentGasKey, densidadGas, realismo);
        
        tGas.innerHTML = `Gas activo: <span style="color: ${gas.colorChart}; font-weight: bold;">${gas.name}</span>`;
        tEnergia.innerHTML = `Energía excitación $E_{ex}$: <span style="color: #f472b6;">${gas.excitationEnergy} eV</span> (${gas.wavelength})`;
        tVoltaje.innerHTML = `Voltaje aceleración $V_a$: <strong>${voltajeAcelerador.toFixed(1)} V</strong>`;
        tCorriente.innerHTML = `Corriente Colectora $I_c$: <span style="color: #22d3ee; font-weight: bold;">${currentI.toFixed(1)} u.a.</span>`;
        
        const numBands = Math.floor(voltajeAcelerador / gas.excitationEnergy);
        tColisiones.innerHTML = `Zonas de colisión: <span style="color: ${gas.colorCollision};">${numBands} visible(s)</span>`;

        if (window.MathJax && window.MathJax.typeset) {
            window.MathJax.typeset();
        }

        fhChart.update("none");
    }

    // === MANEJADORES DE EVENTOS ===
    gasSelect.addEventListener("change", (e) => {
        currentGasKey = e.target.value;
        particles = [];
        drawFullCurve();
        updateTelemetry();
    });

    voltajeSlider.addEventListener("input", (e) => {
        voltajeAcelerador = parseFloat(e.target.value);
        voltajeNum.value = voltajeAcelerador;
        updateTelemetry();
    });

    voltajeNum.addEventListener("change", (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val)) val = 0;
        val = Math.max(0, Math.min(60, val));
        voltajeAcelerador = val;
        voltajeSlider.value = val;
        updateTelemetry();
    });

    densidadSlider.addEventListener("input", (e) => {
        densidadGas = parseFloat(e.target.value);
        densidadNum.value = densidadGas;
        drawFullCurve();
        updateTelemetry();
    });

    densidadNum.addEventListener("change", (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val)) val = 1.0;
        val = Math.max(0.1, Math.min(2.0, val));
        densidadGas = val;
        densidadSlider.value = val;
        drawFullCurve();
        updateTelemetry();
    });

    realismoSlider.addEventListener("input", (e) => {
        realismo = parseFloat(e.target.value);
        drawFullCurve();
        updateTelemetry();
    });

    btnSweep.addEventListener("click", () => {
        if (isSweeping) {
            clearInterval(sweepInterval);
            isSweeping = false;
            btnSweep.textContent = "🚀 Barrido Automático (V)";
            btnSweep.classList.remove("sweep-active");
        } else {
            isSweeping = true;
            btnSweep.textContent = "⏹️ Detener Barrido";
            btnSweep.classList.add("sweep-active");
            voltajeAcelerador = 0.0;
            voltajeSlider.value = 0.0;
            voltajeNum.value = 0.0;
            
            sweepInterval = setInterval(() => {
                voltajeAcelerador += 0.5;
                if (voltajeAcelerador > 60.0) {
                    voltajeAcelerador = 60.0;
                    clearInterval(sweepInterval);
                    isSweeping = false;
                    btnSweep.textContent = "🚀 Barrido Automático (V)";
                    btnSweep.classList.remove("sweep-active");
                }
                voltajeSlider.value = voltajeAcelerador;
                voltajeNum.value = voltajeAcelerador.toFixed(1);
                updateTelemetry();
            }, 45);
        }
    });

    // === MANEJO DE MODALES ===
    btnTutorial.addEventListener("click", () => {
        tutorialModal.style.display = "flex";
    });
    closeTutorial.addEventListener("click", () => {
        tutorialModal.style.display = "none";
    });

    btnInfoFh.addEventListener("click", () => {
        infoFhModal.style.display = "flex";
    });
    closeInfoFh.addEventListener("click", () => {
        infoFhModal.style.display = "none";
    });

    btnInfoTube.addEventListener("click", () => {
        infoTubeModal.style.display = "flex";
    });
    closeInfoTube.addEventListener("click", () => {
        infoTubeModal.style.display = "none";
    });

    window.addEventListener("click", (e) => {
        if (e.target === tutorialModal) tutorialModal.style.display = "none";
        if (e.target === exampleModal) exampleModal.style.display = "none";
        if (e.target === infoFhModal) infoFhModal.style.display = "none";
        if (e.target === infoTubeModal) infoTubeModal.style.display = "none";
    });

    // --- EJEMPLOS PEDAGÓGICOS ---
    btnExample1.addEventListener("click", () => {
        currentGasKey = "hg";
        gasSelect.value = "hg";
        voltajeAcelerador = 22.0;
        voltajeSlider.value = 22.0;
        voltajeNum.value = 22.0;
        densidadGas = 1.2;
        densidadSlider.value = 1.2;
        densidadNum.value = 1.2;
        realismo = 0.3;
        realismoSlider.value = 0.3;

        exampleTitle.textContent = "Ejemplo 1: Excitación del Mercurio (Hg)";
        exampleBody.innerHTML = `
            <p><strong>Configuración aplicada:</strong></p>
            <ul>
                <li>Gas: Mercurio ($Hg$), con energía de excitación teórica $E_{ex} = 4.9\\text{ eV}$.</li>
                <li>Voltaje acelerador ($V_a$): $22.0\\text{ V}$.</li>
                <li>Densidad del gas: $1.2\\text{ u.a.}$.</li>
                <li>Realismo / Dispersión: $0.3$ (bajo ruido).</li>
            </ul>
            <br>
            <h3 style="color:#f472b6;">Análisis del Experimento:</h3>
            <p>Con $22.0\\text{ V}$ aceleradores, los electrones tienen suficiente energía para sufrir hasta 4 colisiones inelásticas consecutivas antes de llegar a la rejilla:</p>
            <div class="formula-card">
                $$N_{máx} = \\lfloor \\frac{V_a - V_{contacto}}{E_{ex}} \\rfloor = \\lfloor \\frac{22.0 - 1.2}{4.9} \\rfloor = \\lfloor 4.24 \\rfloor = 4\\text{ colisiones}$$
            </div>
            <p>Observa el tubo: verás exactamente <strong>4 bandas luminosas de color azul-violeta</strong>. Los electrones pierden $4.9\\text{ eV}$ de energía cinética en cada banda, emitiendo un fotón ultravioleta visible como un destello azulado.</p>
            <p>En el gráfico, el punto actual se encuentra justo después de la cuarta caída periódica de corriente.</p>
        `;
        
        drawFullCurve();
        updateTelemetry();
        exampleModal.style.display = "flex";
    });

    btnExample2.addEventListener("click", () => {
        currentGasKey = "ne";
        gasSelect.value = "ne";
        voltajeAcelerador = 42.0;
        voltajeSlider.value = 42.0;
        voltajeNum.value = 42.0;
        densidadGas = 1.0;
        densidadSlider.value = 1.0;
        densidadNum.value = 1.0;
        realismo = 0.45;
        realismoSlider.value = 0.45;

        exampleTitle.textContent = "Ejemplo 2: Excitación del Neón (Ne)";
        exampleBody.innerHTML = `
            <p><strong>Configuración aplicada:</strong></p>
            <ul>
                <li>Gas: Neón ($Ne$), con energía de excitación teórica $E_{ex} = 18.9\\text{ eV}$.</li>
                <li>Voltaje acelerador ($V_a$): $42.0\\text{ V}$.</li>
                <li>Densidad del gas: $1.0\\text{ u.a.}$.</li>
                <li>Realismo / Dispersión: $0.45$.</li>
            </ul>
            <br>
            <h3 style="color:#f472b6;">Análisis del Experimento:</h3>
            <p>El Neón requiere mucha más energía para excitarse que el Mercurio ($18.9\\text{ eV}$ vs $4.9\\text{ eV}$).</p>
            <p>A $42.0\\text{ V}$ aceleradores, los electrones sufren exactamente 2 colisiones inelásticas en su trayecto:</p>
            <div class="formula-card">
                $$N_{máx} = \\lfloor \\frac{42.0 - 1.2}{18.9} \\rfloor = \\lfloor 2.15 \\rfloor = 2\\text{ colisiones}$$
            </div>
            <p>Esto se traduce en la formación de <strong>2 bandas luminosas de color naranja brillante</strong>.</p>
            <p>En el gráfico de corriente, verás que la corriente ha caído drásticamente dos veces (cerca de los $20\\text{ V}$ y de los $39\\text{ V}$). La distancia exacta entre estos dos valles es la energía de excitación dividida por la carga elemental: $18.9\\text{ V}$.</p>
        `;
        
        drawFullCurve();
        updateTelemetry();
        exampleModal.style.display = "flex";
    });

    // === INICIAR SIMULACIÓN ===
    drawFullCurve();
    updateTelemetry();
    animate();
});
