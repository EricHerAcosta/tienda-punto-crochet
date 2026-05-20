/**
 * Módulo del Experimento de Franck-Hertz
 * Simulación pedagógica interactiva con física pseudo-probabilística
 */

document.addEventListener("DOMContentLoaded", () => {
    // === CONFIGURACIÓN DE LOS GASES ===
    const GAS_DATABASE = {
        hg: {
            name: "Mercurio (Hg)",
            excitationEnergy: 4.9, // eV
            colorGlow: "rgba(129, 140, 248, 0.08)", // Indigo tenue
            colorBand: "rgba(99, 102, 241, 0.45)",  // Indigo brillante
            colorCollision: "#818cf8",              // Color de destello
            colorChart: "#818cf8",
            wavelength: "253.7 nm (UV)"
        },
        ne: {
            name: "Neón (Ne)",
            excitationEnergy: 18.9, // eV
            colorGlow: "rgba(249, 115, 22, 0.08)",  // Naranja tenue
            colorBand: "rgba(249, 115, 22, 0.55)",  // Naranja brillante
            colorCollision: "#f97316",              // Color de destello
            colorChart: "#f97316",
            wavelength: "585.2 nm (Naranja-Rojo)"
        },
        ar: {
            name: "Argón (Ar)",
            excitationEnergy: 11.5, // eV
            colorGlow: "rgba(34, 211, 238, 0.08)",  // Cian tenue
            colorBand: "rgba(6, 182, 212, 0.45)",   // Cian brillante
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
    
    // Dimensiones lógicas del tubo en el canvas
    const tubeX = 80;
    const tubeY = 70;
    const tubeWidth = 640;
    const tubeHeight = 220;

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
                    // Resaltar el punto actual en el que se encuentra el voltaje del slider
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
        
        // Corriente base que aumenta con el voltaje (efecto termoiónico y de aceleración)
        const baseCurrent = 90 * Math.pow(v / 60, 1.25);
        
        // Factor de caída debido a las colisiones inelásticas
        // Cada pico/valle ocurre a múltiplos de Eex + potencial de contacto
        const vContact = 1.2; 
        let dipSum = 0;
        
        // Sumar las caídas (valles) para hasta 8 niveles de colisión
        const maxCollisions = Math.floor(60 / Eex) + 1;
        for (let n = 1; n <= maxCollisions; n++) {
            const center = n * Eex + vContact;
            
            // La dispersión ensancha los picos según el nivel de colisión y el slider de realismo
            // En modo conceptual (realismo = 0) los valles son sumamente angostos y limpios.
            const width = (0.3 + 2.8 * real) * Math.sqrt(n); 
            
            // La amplitud del valle depende de la densidad del gas (más densidad, más colisiones)
            const amplitude = Math.min(0.88, 0.72 * dens);
            
            // Ecuación Gaussiana para el valle de corriente
            dipSum += amplitude * Math.exp(-Math.pow(v - center, 2) / (2 * Math.pow(width, 2)));
        }
        
        // Aplicar los valles a la corriente base
        let current = baseCurrent * (1 - Math.min(0.9, dipSum));
        
        // Añadir ruido experimental realista si el slider está activo
        if (real > 0.05) {
            const noiseAmp = 0.8 * real * Math.sqrt(current);
            current += (Math.random() - 0.5) * noiseAmp;
        }
        
        return Math.max(0.1, current);
    }

    // Dibujar la curva completa en Chart.js
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

    // === CLASE ELECTRÓN PARA LA SIMULACIÓN ===
    class Electron {
        constructor() {
            this.reset();
            // Espaciar el arranque inicial de los electrones
            this.x = tubeX + Math.random() * 30;
        }

        reset() {
            this.x = tubeX;
            this.y = tubeY + 20 + Math.random() * (tubeHeight - 40);
            this.vx = 0.2 + Math.random() * 0.4;
            this.vy = (Math.random() - 0.5) * 0.2;
            this.energy = 0; // eV
            this.dead = false;
            this.collidedThisFrame = false;
        }

        update() {
            if (this.dead) return;

            const gas = GAS_DATABASE[currentGasKey];
            const Eex = gas.excitationEnergy;

            // 1. Aceleración eléctrica (Cátodo -> Rejilla)
            // Rejilla posicionada al 90% del tubo
            const gridX = tubeX + tubeWidth * 0.9;
            const collectorX = tubeX + tubeWidth;
            
            if (this.x < gridX) {
                // Campo eléctrico acelerador
                const fraction = (this.x - tubeX) / (gridX - tubeX);
                // La energía cinética depende de la posición y el voltaje
                this.energy = voltajeAcelerador * fraction;
                
                // Fuerza aceleradora
                const acc = (voltajeAcelerador / (gridX - tubeX)) * 0.04;
                this.vx += acc;
            } else if (this.x >= gridX && this.x < collectorX) {
                // Campo retardador entre la rejilla y el colector (potencial de frenado V_r)
                const fractionRetard = (this.x - gridX) / (collectorX - gridX);
                this.energy = Math.max(0, this.energy - retardingPotential * fractionRetard);
                
                const dec = (retardingPotential / (collectorX - gridX)) * 0.04;
                this.vx -= dec;
            }

            // 2. Comportamiento de colisión (solo en la región de aceleración)
            if (this.x < gridX && this.energy >= Eex) {
                // Probabilidad de colisión inelástica
                // En modo conceptual, colisiona inmediatamente al llegar a Eex
                // En modo realista, depende de la densidad y la energía por encima de Eex
                let collisionProb = 1.0;
                if (realismo > 0.05) {
                    collisionProb = 1.0 - Math.exp(-densidadGas * (this.energy - Eex) * 2.0);
                }

                if (Math.random() < collisionProb) {
                    // ¡COLISIÓN INELÁSTICA!
                    this.energy = Math.max(0, this.energy - Eex);
                    
                    // Re-calcular velocidad a partir de la energía residual
                    const newSpeed = Math.sqrt(this.energy) * 0.5 + 0.1;
                    this.vx = newSpeed;
                    
                    // Dispersión angular elástica realista
                    if (realismo > 0.1) {
                        this.vy = (Math.random() - 0.5) * realismo * 1.5;
                    } else {
                        this.vy = 0;
                    }

                    // Crear destello de excitación
                    collisionEffects.push({
                        x: this.x,
                        y: this.y,
                        radius: 2,
                        maxRadius: 12 + Math.random() * 8,
                        alpha: 1.0,
                        color: gas.colorCollision
                    });

                    // Emitir fotón (onda de luz)
                    if (Math.random() < 0.7) {
                        lightWaves.push({
                            x: this.x,
                            y: this.y,
                            vx: (Math.random() - 0.5) * 1.0,
                            vy: -1.5 - Math.random() * 1.0,
                            alpha: 1.0,
                            color: gas.colorCollision
                        });
                    }
                }
            }

            // Avanzar posición
            this.x += this.vx;
            this.y += this.vy;

            // Límites físicos del tubo de vidrio
            if (this.y < tubeY + 5) {
                this.y = tubeY + 5;
                this.vy = -this.vy * 0.5;
            }
            if (this.y > tubeY + tubeHeight - 5) {
                this.y = tubeY + tubeHeight - 5;
                this.vy = -this.vy * 0.5;
            }

            // Llegada al final del tubo (Colector)
            if (this.x >= collectorX) {
                // Solo si la energía es mayor que el potencial de frenado llega y genera corriente
                if (this.energy >= 0.01 && this.vx > 0) {
                    // Éxito: llega al colector
                    this.dead = true;
                } else {
                    // Se frena y rebota o se pierde
                    this.vx = -0.2;
                    this.vy = (Math.random() - 0.5) * 0.5;
                    if (this.x > collectorX + 10 || this.x < gridX) {
                        this.dead = true;
                    }
                }
            }
        }

        draw() {
            if (this.dead) return;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = "#22d3ee"; // Electrones cian brillantes
            ctx.shadowBlur = 8;
            ctx.shadowColor = "#22d3ee";
            ctx.fill();
            ctx.shadowBlur = 0; // Reset shadow
        }
    }

    // === BUCLE DE RENDERIZACIÓN Y ANIMACIÓN ===
    function animate() {
        // Limpiar lienzo
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const gas = GAS_DATABASE[currentGasKey];

        // 1. Dibujar el Tubo de Vidrio (Fondo)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 2;
        ctx.fillStyle = "rgba(15, 23, 42, 0.4)";
        
        // Redondear las esquinas del tubo de vidrio para simular una ampolla
        ctx.beginPath();
        ctx.roundRect(tubeX, tubeY, tubeWidth, tubeHeight, 15);
        ctx.fill();
        ctx.stroke();

        // Resplandor de gas de fondo
        ctx.fillStyle = gas.colorGlow;
        ctx.beginPath();
        ctx.roundRect(tubeX + 5, tubeY + 5, tubeWidth - 10, tubeHeight - 10, 10);
        ctx.fill();

        // 2. Dibujar Electrodos
        // Cátodo (Izquierda - filamento emisor)
        ctx.strokeStyle = "#f59e0b"; // Naranja cálido
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(tubeX + 15, tubeY + 40);
        ctx.lineTo(tubeX + 15, tubeY + tubeHeight - 40);
        ctx.stroke();
        
        // Conexiones del cátodo
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tubeX + 15, tubeY + 40);
        ctx.lineTo(tubeX - 20, tubeY + 40);
        ctx.moveTo(tubeX + 15, tubeY + tubeHeight - 40);
        ctx.lineTo(tubeX - 20, tubeY + tubeHeight - 40);
        ctx.stroke();

        // Rejilla Aceleradora (Grid - Derecha)
        const gridX = tubeX + tubeWidth * 0.9;
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]); // Línea discontinua que representa la rejilla calada
        ctx.beginPath();
        ctx.moveTo(gridX, tubeY + 15);
        ctx.lineTo(gridX, tubeY + tubeHeight - 15);
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash

        // Soporte de rejilla
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.beginPath();
        ctx.moveTo(gridX, tubeY + 15);
        ctx.lineTo(gridX, tubeY - 20);
        ctx.stroke();

        // Colector (Placa final - Derecha)
        const collectorX = tubeX + tubeWidth - 15;
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(collectorX, tubeY + 30);
        ctx.lineTo(collectorX, tubeY + tubeHeight - 30);
        ctx.stroke();
        
        // Conexión del colector
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(collectorX, tubeY + tubeHeight / 2);
        ctx.lineTo(collectorX + 40, tubeY + tubeHeight / 2);
        ctx.stroke();

        // Etiquetas de texto sobre los elementos
        ctx.fillStyle = "#94a3b8";
        ctx.font = "12px Inter";
        ctx.fillText("Cátodo (K)", tubeX - 10, tubeY + 25);
        ctx.fillText("Rejilla (G)", gridX - 30, tubeY + 10);
        ctx.fillText("Colector (A)", collectorX - 25, tubeY + 25);

        // 3. Dibujar Bandas de Excitación de Gas (Glow Físico)
        // Ocurren en los lugares espaciales donde los electrones alcanzan múltiplos de Eex
        if (voltajeAcelerador > gas.excitationEnergy) {
            const numBands = Math.floor(voltajeAcelerador / gas.excitationEnergy);
            
            for (let i = 1; i <= numBands; i++) {
                // Posición horizontal fraccionaria de la banda
                const bandPosFract = (i * gas.excitationEnergy) / voltajeAcelerador;
                // La banda se forma a esta distancia X del cátodo
                const bandX = tubeX + (gridX - tubeX) * bandPosFract;
                
                // Dibujar gradiente luminoso vertical
                const grad = ctx.createLinearGradient(bandX - 20, 0, bandX + 20, 0);
                grad.addColorStop(0, "rgba(255,255,255,0)");
                grad.addColorStop(0.5, gas.colorBand);
                grad.addColorStop(1, "rgba(255,255,255,0)");
                
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.rect(bandX - 25, tubeY + 5, 50, tubeHeight - 10);
                ctx.fill();

                // Dibujar una línea central indicativa
                ctx.strokeStyle = "rgba(255,255,255,0.15)";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(bandX, tubeY + 5);
                ctx.lineTo(bandX, tubeY + tubeHeight - 5);
                ctx.stroke();
            }
        }

        // 4. Actualizar y Dibujar Electrones
        // Mantener población estable de electrones
        const targetCount = Math.floor(25 + densidadGas * 30);
        while (particles.length < targetCount) {
            particles.push(new Electron());
        }

        particles.forEach((p, idx) => {
            p.update();
            p.draw();
            if (p.dead) {
                particles[idx] = new Electron();
            }
        });

        // 5. Dibujar Efectos de Colisiones (Anillos que se expanden)
        collisionEffects.forEach((eff, idx) => {
            eff.radius += 0.5;
            eff.alpha -= 0.04;
            
            if (eff.alpha <= 0) {
                collisionEffects.splice(idx, 1);
                return;
            }

            ctx.strokeStyle = eff.color;
            ctx.globalAlpha = eff.alpha;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(eff.x, eff.y, eff.radius, 0, Math.PI * 2);
            ctx.stroke();
        });
        ctx.globalAlpha = 1.0; // Reset alpha

        // 6. Actualizar y Dibujar Fotones (Ondas luminosas flotantes)
        lightWaves.forEach((w, idx) => {
            w.x += w.vx;
            w.y += w.vy;
            w.alpha -= 0.02;

            if (w.alpha <= 0 || w.y < tubeY + 10) {
                lightWaves.splice(idx, 1);
                return;
            }

            ctx.strokeStyle = w.color;
            ctx.globalAlpha = w.alpha;
            ctx.lineWidth = 1;
            
            // Dibujar pequeña forma de onda sinusoidal
            ctx.beginPath();
            for (let i = -5; i <= 5; i++) {
                const wx = w.x + i;
                const wy = w.y + Math.sin(i * 1.5) * 3;
                if (i === -5) ctx.moveTo(wx, wy);
                else ctx.lineTo(wx, wy);
            }
            ctx.stroke();
        });
        ctx.globalAlpha = 1.0; // Reset alpha

        // Solicitar el siguiente cuadro
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

        // Disparar render de MathJax para formatear las fórmulas escritas en HTML dinámico
        if (window.MathJax && window.MathJax.typeset) {
            window.MathJax.typeset();
        }

        // Forzar actualización del gráfico para mover el punto resaltado
        fhChart.update("none"); // "none" evita animaciones pesadas a 60fps
    }

    // === MANEJADORES DE EVENTOS DE CONTROLES ===
    
    // Cambio de Gas
    gasSelect.addEventListener("change", (e) => {
        currentGasKey = e.target.value;
        particles = []; // Limpiar electrones antiguos
        drawFullCurve();
        updateTelemetry();
    });

    // Voltaje Slider & Input Numérico
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

    // Densidad Slider & Input Numérico
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

    // Slider de Realismo
    realismoSlider.addEventListener("input", (e) => {
        realismo = parseFloat(e.target.value);
        drawFullCurve();
        updateTelemetry();
    });

    // Botón Barrido Automático (Sweep)
    btnSweep.addEventListener("click", () => {
        if (isSweeping) {
            // Detener
            clearInterval(sweepInterval);
            isSweeping = false;
            btnSweep.textContent = "🚀 Barrido Automático (V)";
            btnSweep.classList.remove("sweep-active");
        } else {
            // Iniciar
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
            }, 45); // ~11 V por segundo
        }
    });

    // === CONTROL DE MODALES ===
    
    // Tutorial Modal
    btnTutorial.addEventListener("click", () => {
        tutorialModal.style.display = "flex";
    });
    closeTutorial.addEventListener("click", () => {
        tutorialModal.style.display = "none";
    });

    // Info Gráfico Modal
    btnInfoFh.addEventListener("click", () => {
        infoFhModal.style.display = "flex";
    });
    closeInfoFh.addEventListener("click", () => {
        infoFhModal.style.display = "none";
    });

    // Cerrar modales si se hace clic fuera del recuadro
    window.addEventListener("click", (e) => {
        if (e.target === tutorialModal) tutorialModal.style.display = "none";
        if (e.target === exampleModal) exampleModal.style.display = "none";
        if (e.target === infoFhModal) infoFhModal.style.display = "none";
    });

    // --- EJEMPLOS PEDAGÓGICOS ---
    btnExample1.addEventListener("click", () => {
        // Ejemplo 1: Mercurio a 4.9V
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
                <li>Densidad del gas: $1.2\\text{ u.a.}$ (alta probabilidad de colisión).</li>
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
        // Ejemplo 2: Neón a 18.9V
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
