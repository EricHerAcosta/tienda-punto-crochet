document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements - Selectors
    const materialSelect = document.getElementById('material');
    
    // Lambda
    const lambdaSlider = document.getElementById('lambda-slider');
    const lambdaNum = document.getElementById('lambda-num');
    
    // Intensidad
    const intSlider = document.getElementById('intensidad-slider');
    const intNum = document.getElementById('intensidad-num');
    
    // Voltaje
    const voltSlider = document.getElementById('voltaje-slider');
    const voltNum = document.getElementById('voltaje-num');

    // Telemetría
    const tFoton = document.getElementById('t-foton');
    const tKmax = document.getElementById('t-kmax');
    const tVstop = document.getElementById('t-vstop');
    const tEstado = document.getElementById('t-estado');

    let chartIV = null;
    let chartKmax = null;

    // Canvas
    const canvas = document.getElementById('physics-canvas');
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // Estado físico (alimentado por Backend)
    let state = {
        emite: false,
        k_max_ev: 0.0,
        i_relativa: 0.0,
        v_stopping: 0.0,
        intensidad: 50
    };

    // Partículas
    let photons = [];
    let electrons = [];

    // --- Sincronización Básica UI ---
    function syncNumToSlider(numInput, sliderInput, callback) {
        sliderInput.value = numInput.value;
        if(callback) callback();
    }
    function syncSliderToNum(sliderInput, numInput, callback) {
        numInput.value = sliderInput.value;
        if(callback) callback();
    }

    [
        { num: lambdaNum, slider: lambdaSlider },
        { num: intNum, slider: intSlider },
        { num: voltNum, slider: voltSlider }
    ].forEach(pair => {
        pair.num.addEventListener('input', () => syncNumToSlider(pair.num, pair.slider, triggerCalculation));
        pair.slider.addEventListener('input', () => syncSliderToNum(pair.slider, pair.num, triggerCalculation));
    });

    materialSelect.addEventListener('change', triggerCalculation);

    // Color aproximado dado longitud de onda
    function wavelengthToColor(lambda) {
        if(lambda < 380) return 'rgba(200, 0, 255, 0.8)'; // UV simulación visual
        let r, g, b;
        if (lambda >= 380 && lambda < 440) { r = -(lambda - 440) / (440 - 380); g = 0; b = 1; }
        else if (lambda >= 440 && lambda < 490) { r = 0; g = (lambda - 440) / (490 - 440); b = 1; }
        else if (lambda >= 490 && lambda < 510) { r = 0; g = 1; b = -(lambda - 510) / (510 - 490); }
        else if (lambda >= 510 && lambda < 580) { r = (lambda - 510) / (580 - 510); g = 1; b = 0; }
        else if (lambda >= 580 && lambda < 645) { r = 1; g = -(lambda - 645) / (645 - 580); b = 0; }
        else if (lambda >= 645 && lambda <= 780) { r = 1; g = 0; b = 0; }
        else { r = 1; g = 0; b = 0; } // Infrarrojo
        
        let S = 1;
        if (lambda > 700) S = 0.3 + 0.7 * (780 - lambda) / (780 - 700);
        else if (lambda < 420) S = 0.3 + 0.7 * (lambda - 380) / (420 - 380);
        
        return `rgba(${Math.floor(r * 255)}, ${Math.floor(g * 255)}, ${Math.floor(b * 255)}, ${S})`;
    }

    // --- CANVAS ENGINE ---
    function resizeCanvas() {
        const container = canvas.parentElement;
        canvas.width = container.clientWidth - 32;
        canvas.height = container.clientHeight - 32;
    }
    window.addEventListener('resize', resizeCanvas);

    function spawnParticle() {
        // Generar fotones apuntando del techo hacia la placa emisora
        if (Math.random() < (state.intensidad / 100)) {
            photons.push({
                x: canvas.width / 2,
                y: 0,
                targetX: canvas.width * 0.1, // Posición placa izq
                targetY: canvas.height / 2 + (Math.random() * 80 - 40),
                speed: 5
            });
        }
    }

    class Electron {
        constructor(y, k_max, stopped_by_volt) {
            this.x = canvas.width * 0.1 + 20; // Sale de la placa
            this.y = y;
            // Velocidad mapeada a Energía Cinética.
            this.vx = 1 + k_max; 
            this.ax = stopped_by_volt ? -0.05 : 0; // Frenado
            this.radius = 3;
            this.active = true;
        }
        update() {
            this.vx += this.ax;
            this.x += this.vx;
            
            // Si el voltaje lo frenó por completo y empieza a devolverse
            if (this.ax < 0 && this.vx <= 0) {
                // Se detiene y va de vuelta a la placa emisora
                this.ax = -0.1;
            }
            // Muerte
            if (this.x < canvas.width * 0.1 || this.x > canvas.width * 0.9) {
                this.active = false;
            }
        }
        draw(ctx) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#f472b6';
            ctx.fill();
        }
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const currentColor = wavelengthToColor(parseFloat(lambdaNum.value));
        
        // Dibujar Luz
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, -10);
        ctx.lineTo(canvas.width * 0.1, canvas.height / 2 - 50);
        ctx.lineTo(canvas.width * 0.1, canvas.height / 2 + 50);
        ctx.fillStyle = currentColor;
        ctx.globalAlpha = (state.intensidad / 100) * 0.5;
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Placas
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(canvas.width * 0.1 - 10, canvas.height / 2 - 50, 20, 100); // Emisor
        ctx.fillRect(canvas.width * 0.9 - 10, canvas.height / 2 - 50, 20, 100); // Colector

        // Etiquetas Placas
        ctx.fillStyle = 'white'; ctx.textAlign = 'center';
        ctx.fillText("Cátodo (-)", canvas.width * 0.1, canvas.height / 2 + 70);
        ctx.fillText("Ánodo (+)", canvas.width * 0.9, canvas.height / 2 + 70);

        // Actualizar fotones (Visuales oscilantes puntuales)
        spawnParticle();
        for (let i = photons.length - 1; i >= 0; i--) {
            let p = photons[i];
            let dx = p.targetX - p.x;
            let dy = p.targetY - p.y;
            let dist = Math.hypot(dx, dy);
            
            p.x += (dx / dist) * p.speed * 2;
            p.y += (dy / dist) * p.speed * 2;

            ctx.beginPath();
            ctx.arc(p.x, p.y + Math.sin(p.x * 0.1) * 5, 2, 0, Math.PI * 2);
            ctx.fillStyle = '#fff'; ctx.fill();

            if (dist < 10) {
                // Impactó
                photons.splice(i, 1);
                
                // Si hay emisión, hay chance de escupir electrón
                if (state.emite) {
                    let volt = parseFloat(voltNum.value);
                    // Si voltaje es lo suficientemente negativo, frenerá el electron eventualmente en el canvas
                    let stopped = (volt < 0 && Math.abs(volt) >= state.v_stopping);
                    
                    electrons.push(new Electron(p.targetY, state.k_max_ev, stopped));
                }
            }
        }

        // Actualizar Electrones
        for (let i = electrons.length - 1; i >= 0; i--) {
            electrons[i].update();
            electrons[i].draw(ctx);
            if (!electrons[i].active) electrons.splice(i, 1);
        }

        animationFrameId = requestAnimationFrame(animate);
    }

    // --- CHARTS ENGINE ---
    function initCharts() {
        const ctxIV = document.getElementById('chart-iv').getContext('2d');
        chartIV = new Chart(ctxIV, {
            type: 'line',
            data: {
                labels: [], 
                datasets: [{
                    label: 'Corriente i (mA)', data: [],
                    borderColor: '#f472b6', backgroundColor: 'rgba(244, 114, 182, 0.1)',
                    borderWidth: 2, fill: true, tension: 0.1, pointRadius: 0
                },
                {
                    label: 'Punto', data: [], borderColor: '#fff', backgroundColor: '#fff', pointRadius: 5
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, color: '#f8fafc',
                scales: {
                    x: { title: { display: true, text: 'Voltaje (V)', color: '#94a3b8' } },
                    y: { title: { display: true, text: 'Corriente', color: '#94a3b8' } }
                },
                plugins: { legend: { display: false } }
            }
        });

        const ctxKmax = document.getElementById('chart-kmax').getContext('2d');
        chartKmax = new Chart(ctxKmax, {
            type: 'line',
            data: {
                labels: [], 
                datasets: [{
                    label: 'Kmax (eV)', data: [],
                    borderColor: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.1)',
                    borderWidth: 2, fill: true, tension: 0.1, pointRadius: 0
                },
                {
                    label: 'Punto', data: [], borderColor: '#fff', backgroundColor: '#fff', pointRadius: 5
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, color: '#f8fafc',
                scales: {
                    x: { title: { display: true, text: 'Frecuencia ν (10^14 Hz)', color: '#94a3b8' } },
                    y: { title: { display: true, text: 'K_max (eV)', color: '#94a3b8' } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    function updateChartsVisuals(data) {
        // Construir curva I vs V
        const iLabels = [];
        const iData = [];
        const iMax = state.intensidad;
        const vStop = data.v_stopping;
        
        for(let v = -10; v <= 10; v += 0.5) {
            iLabels.push(v.toFixed(1));
            if (v >= 0) iData.push(iMax);
            else {
                if (Math.abs(v) >= vStop) iData.push(0);
                else {
                    let d = iMax * (1.0 - (Math.abs(v) / vStop));
                    iData.push(d);
                }
            }
        }
        
        chartIV.data.labels = iLabels;
        chartIV.data.datasets[0].data = iData;
        
        // Punto actual IV (Solo anclar el índice MÁS cercano estrictamente para que intercepte perfecto en el Tick)
        const currentV = parseFloat(voltNum.value);
        let closestVi = -1;
        let minVdiff = Infinity;
        iLabels.forEach((lbl, i) => {
            let diff = Math.abs(parseFloat(lbl) - currentV);
            if (diff < minVdiff) { minVdiff = diff; closestVi = i; }
        });
        chartIV.data.datasets[1].data = iLabels.map((v, i) => (i === closestVi) ? data.corriente_relativa : null);
        chartIV.update();

        // Construir Curva K_max vs Frecuencia
        const kLabels = [];
        const kData = [];
        const phi = parseFloat(materialSelect.value);
        
        // Frecuencia = c / lambda (ej: 3e8 / 400e-9 = 7.5e14 Hz)
        // Convertimos X-axis a 10^14 Hz. 100nm son 30x10^14.
        for (let freq14 = 3; freq14 <= 30; freq14 += 1) {
            kLabels.push(freq14.toFixed(1));
            // E = h * freq
            // h en eV*s ≈ 4.135e-15
            // E = 4.135e-15 * (freq14 * 1e14) = 4.135 * freq14 * 0.1 eV = 0.4135 * freq14
            let E = 0.41356 * freq14; 
            let k = E - phi;
            kData.push(k > 0 ? k : 0);
        }

        chartKmax.data.labels = kLabels;
        chartKmax.data.datasets[0].data = kData;
        
        const currentLambda = parseFloat(lambdaNum.value);
        const currentFreq14 = (3000 / currentLambda); // (3e8 / (λ * 1e-9)) = 3e17 / λ = 3000 / λ * 1e14
        
        // Evitar duplicados. Buscar estrictamente el TICK más cercano
        let closestKi = -1;
        let minKdiff = Infinity;
        kLabels.forEach((lbl, i) => {
            let diff = Math.abs(parseFloat(lbl) - currentFreq14);
            if (diff < minKdiff) { minKdiff = diff; closestKi = i; }
        });
        chartKmax.data.datasets[1].data = kLabels.map((f, i) => (i === closestKi) ? data.k_max_ev : null);
        chartKmax.update();
    }

    // --- API CALL ENGINES ---
    async function triggerCalculation() {
        const lambda = encodeURIComponent(lambdaNum.value);
        const intensidad = encodeURIComponent(intNum.value);
        const volts = encodeURIComponent(voltNum.value);
        const phi = encodeURIComponent(materialSelect.value);

        try {
            const url = `/api/fotoelectrico/calcular?lambda_nm=${lambda}&intensidad=${intensidad}&voltaje=${volts}&phi_ev=${phi}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            // Update State for Canvas
            state.emite = data.emite;
            state.k_max_ev = data.k_max_ev;
            state.i_relativa = data.corriente_relativa;
            state.v_stopping = data.v_stopping;
            state.intensidad = parseFloat(intNum.value);

            // Update Telemetry con MathJax Nativo
            tFoton.innerHTML = `$$ E_{\text{Fotón}} = ${data.energia_foton_ev.toFixed(2)} \text{ eV} $$`;
            tKmax.innerHTML = `$$ K_{\text{max}} = ${data.k_max_ev.toFixed(2)} \text{ eV} $$`;
            tVstop.innerHTML = `$$ V_{\text{frenado}} = ${data.v_stopping.toFixed(2)} \text{ V} $$`;
            
            if (data.emite) {
                tEstado.innerHTML = "$$ \\text{Estado: EMITIENDO ELECTRONES} $$";
                tEstado.style.color = "#4ade80";
            } else {
                tEstado.innerHTML = "$$ \\text{Estado: SIN EMISIÓN } (E < \\phi) $$";
                tEstado.style.color = "#f87171";
            }

            // Mathjax forzoso sobre la telemetría recalculada
            if(window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
                MathJax.typesetPromise([tFoton, tKmax, tVstop, tEstado]).catch(e => {});
            }

            if(chartIV && chartKmax) {
                updateChartsVisuals(data);
            }

        } catch (e) {
            console.error("API Error", e);
        }
    }

    // --- LÓGICA DE MODALES Y EJEMPLOS ---
    const tutorialModal = document.getElementById('tutorial-modal');
    const exampleModal = document.getElementById('example-modal');
    
    document.getElementById('btn-tutorial').addEventListener('click', () => tutorialModal.style.display = 'flex');
    document.getElementById('close-modal').addEventListener('click', () => tutorialModal.style.display = 'none');
    
    document.getElementById('close-example').addEventListener('click', () => exampleModal.style.display = 'none');
    document.getElementById('close-example-btn').addEventListener('click', () => exampleModal.style.display = 'none');
    
    window.addEventListener('click', (e) => {
        if(e.target === tutorialModal) tutorialModal.style.display = 'none';
        if(e.target === exampleModal) exampleModal.style.display = 'none';
    });

    const exTitle = document.getElementById('ex-title');
    const exDesc = document.getElementById('ex-desc');

    document.getElementById('btn-example1').addEventListener('click', () => {
        materialSelect.value = "4.31"; // Zinc
        lambdaNum.value = 200; lambdaSlider.value = 200;
        intNum.value = 100; intSlider.value = 100;
        voltNum.value = 0; voltSlider.value = 0;
        
        triggerCalculation();
        
        exTitle.innerText = "Ejemplo 1: Emisión UV en el Zinc";
        exDesc.innerHTML = "El Zinc tiene una función de trabajo muy elevada (<b>4.31 eV</b>). Sin embargo, un fotón de luz Ultravioleta extrema (200 nm = <b>6.20 eV</b>) logra expulsar el electrón de su atrincheramiento. Ese residuo energético altísimo es transformado íntegramente en la velocidad máxima (\(K_{max}\)) con la que viaja el electrón.";
        exampleModal.style.display = 'flex';
        if(window.MathJax) MathJax.typesetPromise([exDesc]).catch(e => {});
    });

    document.getElementById('btn-example2').addEventListener('click', () => {
        materialSelect.value = "2.28"; // Sodio
        lambdaNum.value = 544; lambdaSlider.value = 544;
        intNum.value = 80; intSlider.value = 80;
        voltNum.value = 0; voltSlider.value = 0;
        
        triggerCalculation();
        
        exTitle.innerText = "Ejemplo 2: Frecuencia de Corte (Sodio)";
        exDesc.innerHTML = "La barrera del sodio es <b>2.28 eV</b>. Al iluminarlo con luz verde pálida de 544 nm (que transporta exactamente <b>2.28 eV</b>), lo empujamos al límite cuántico, expulsando los electrones con una energía remanente casi nula. Si elevas la longitud de onda aunque sea por 1 nm más hacia el rojo, **jamás** habrá emisión, demostrando empíricamente la frecuencia de corte (\(f_0\)) del experimento.";
        exampleModal.style.display = 'flex';
        if(window.MathJax) MathJax.typesetPromise([exDesc]).catch(e => {});
    });

    document.getElementById('btn-info-iv').addEventListener('click', () => {
        exTitle.innerText = "Interpretar: Corriente vs Voltaje";
        exDesc.innerHTML = "<p>Esta gráfica ilustra cómo fluctúa la <b>Corriente (\(i\))</b> del tubo respecto al <b>Voltaje Aplicado (\(V\))</b>.</p><br><ul style='text-align: left; font-size: 0.95rem; margin-left: 20px;'><li>El <b>eje \(X\)</b> representa el Voltaje que aplicas. Si el voltaje es fuertemente negativo, este se opone a los electrones forzándolos a regresar a la placa.</li><li>El <b>eje \(Y\)</b> mide la corriente detectada (caudal fotónico transformado).</li><li>El <b style='color:#38bdf8'>punto dinámico</b> rastrea físicamente tus parámetros actuales. Si dicho punto se estrella contra una corriente 0 (eje inferior), significa que tu Batería fue lo suficientemente fuerte para destruir todo el flujo de electrones asumiendo el Voltaje de Frenado exacto.</li></ul>";
        exampleModal.style.display = 'flex';
        if(window.MathJax) MathJax.typesetPromise([exDesc]).catch(e => {});
    });

    document.getElementById('btn-info-kmax').addEventListener('click', () => {
        exTitle.innerText = "Interpretar: Energía K_max vs Frecuencia";
        exDesc.innerHTML = "<p>Esta gráfica revela el misterio cuántico principal exponiendo <b>Energía Cinética (\(K_{max}\)) vs Frecuencia (\(\nu\))</b>.</p><br><ul style='text-align: left; font-size: 0.95rem; margin-left: 20px;'><li>El <b>eje \(X\)</b> mide la frecuencia de fotones (en \(\times 10^{14}\) Hz). Físicamente, un valor bajo en Nanómetros (UV) produce una Frecuencia elevadísima hacia la derecha.</li><li>El <b>eje \(Y\)</b> muestra directamente la Energía Cinética remanente (en \(eV\)) adquirida por las partículas expulsadas.</li><li>La línea recta siempre nace en base a cero. Al punto donde \"toca cero\" se lo denomina <b>Frecuencia Umbral (\(f_0\))</b>, y su posición depende 100% del Material metálito elegido.</li><li>Intenta arrastrar la \(\lambda\) muy alto (Infrarrojo): notarás que el <b>Punto dinámico</b> desaparece, ilustrando que a bajas frecuencias la luz rebota estérilmente sobre el metal.</li></ul>";
        exampleModal.style.display = 'flex';
        if(window.MathJax) MathJax.typesetPromise([exDesc]).catch(e => {});
    });

    // Init Sequence
    resizeCanvas();
    initCharts();
    
    // Iniciar con MathJax si es que existen etiquetas ($$) en HTML
    if(typeof window.MathJax !== 'undefined' && typeof window.MathJax.typesetPromise === 'function') {
        const lblMat = document.getElementById('lbl-material');
        const lblLam = document.getElementById('lbl-lambda');
        const lblInt = document.getElementById('lbl-intensidad');
        const lblVol = document.getElementById('lbl-voltaje');
        MathJax.typesetPromise([lblMat, lblLam, lblInt, lblVol]).catch(console.error);
    }

    triggerCalculation();
    animate();
});
