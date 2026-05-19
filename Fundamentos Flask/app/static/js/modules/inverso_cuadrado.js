document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements - Selectors
    const scenarioSelect = document.getElementById('scenario');
    
    // Distancia
    const rInput = document.getElementById('distancia');
    const rNum = document.getElementById('dist-num');
    const rUnit = document.getElementById('dist-unit');
    const lblDist = document.getElementById('lbl-dist');

    // Valor 1
    const v1Input = document.getElementById('valor1');
    const v1Num = document.getElementById('v1-num');
    const v1Unit = document.getElementById('v1-unit');
    const lblVal1 = document.getElementById('lbl-val1');

    // Valor 2
    const v2Input = document.getElementById('valor2');
    const v2Num = document.getElementById('v2-num');
    const v2Unit = document.getElementById('v2-unit');
    const lblVal2 = document.getElementById('lbl-val2');

    const resultH2 = document.getElementById('fuerza-result');
    const formulaText = document.getElementById('formula-text');

    let physicsChart = null;
    const canvas = document.getElementById('physics-canvas');
    const ctx = canvas.getContext('2d');

    // State
    let entities = {
        e1: { x: 0, y: 0, radius: 20 },
        e2: { x: 0, y: 0, radius: 15 }
    };
    let draggingEntity = null;

    // Constantes de conversion a Unidades del SI
    const CONVERSIONS = {
        // Distancia a Metros
        m: 1,
        km: 1e3,
        au: 1.496e11,
        ly: 9.461e15,
        cm: 1e-2,
        mm: 1e-3,
        um: 1e-6,
        nm: 1e-9,
        // Masas a Kg
        kg: 1,
        g: 1e-3,
        ton: 1000,
        sol: 1.989e30, // Solar mass
        // Cargas a Coulombs
        c: 1,
        mc: 1e-3, // mili
        mic: 1e-6, // micro
        nc: 1e-9   // nano
    };

    function populateUnits() {
        const scenario = scenarioSelect.value;
        const massUnits = `
            <option value="kg">kg</option>
            <option value="g">gramos</option>
            <option value="ton">toneladas</option>
            <option value="sol">M☉ (Masas Solares)</option>
        `;
        const chargeUnits = `
            <option value="c">C</option>
            <option value="mc">mC</option>
            <option value="mic" selected>µC</option>
            <option value="nc">nC</option>
        `;
        const gravDistUnits = `
            <option value="m">m (Metros)</option>
            <option value="km">km</option>
            <option value="au">AU</option>
            <option value="ly">Años Luz</option>
        `;
        const coulombDistUnits = `
            <option value="m">m (Metros)</option>
            <option value="cm" selected>cm</option>
            <option value="mm">mm</option>
            <option value="um">µm</option>
            <option value="nm">nm</option>
        `;
        
        v1Unit.innerHTML = scenario === 'gravedad' ? massUnits : chargeUnits;
        v2Unit.innerHTML = scenario === 'gravedad' ? massUnits : chargeUnits;
        rUnit.innerHTML = scenario === 'gravedad' ? gravDistUnits : coulombDistUnits;
    }

    function syncNumToSlider(numInput, sliderInput) {
        sliderInput.value = numInput.value;
    }
    
    function syncSliderToNum(sliderInput, numInput) {
        numInput.value = sliderInput.value;
    }

    // Handlers para las Cajas de Número
    rNum.addEventListener('input', () => { syncNumToSlider(rNum, rInput); updatePositionsFromR(); fetchPhysicsData(); });
    v1Num.addEventListener('input', () => { syncNumToSlider(v1Num, v1Input); drawPhysics(); updateChartCurve(); fetchPhysicsData(); });
    v2Num.addEventListener('input', () => { syncNumToSlider(v2Num, v2Input); drawPhysics(); updateChartCurve(); fetchPhysicsData(); });

    // Handlers para los Sliders
    rInput.addEventListener('input', () => { syncSliderToNum(rInput, rNum); updatePositionsFromR(); fetchPhysicsData(); });
    v1Input.addEventListener('input', () => { syncSliderToNum(v1Input, v1Num); drawPhysics(); updateChartCurve(); fetchPhysicsData(); });
    v2Input.addEventListener('input', () => { syncSliderToNum(v2Input, v2Num); drawPhysics(); updateChartCurve(); fetchPhysicsData(); });

    // Cuando cambia la unidad recalculamos la curva general y el punto
    rUnit.addEventListener('change', () => { updateChartCurve(); fetchPhysicsData(); });
    v1Unit.addEventListener('change', () => { updateChartCurve(); fetchPhysicsData(); });
    v2Unit.addEventListener('change', () => { updateChartCurve(); fetchPhysicsData(); });

    function resizeCanvas() {
        const container = canvas.parentElement;
        canvas.width = container.clientWidth - 32;
        canvas.height = container.clientHeight - 32;
        entities.e1.y = canvas.height / 2;
        entities.e2.y = canvas.height / 2;
        entities.e1.x = 50;
        updatePositionsFromR(); 
    }
    window.addEventListener('resize', resizeCanvas);

    function calcRadius(value, isM1) {
        const scenario = scenarioSelect.value;
        const minVal = parseFloat(isM1 ? v1Input.min : v2Input.min);
        const maxVal = parseFloat(isM1 ? v1Input.max : v2Input.max);
        
        // Evitar divisor cero o negativos extraños
        let ratio = (value - minVal) / (maxVal - minVal);
        if(ratio < 0) ratio = 0; if (ratio > 1) ratio = 1;
        
        const minRadius = 10;
        const maxRadius = scenario === 'gravedad' ? 45 : 30; // Gravedad es mas inflada
        return minRadius + (maxRadius - minRadius) * ratio;
    }

    function updatePositionsFromR() {
        const r = parseFloat(rInput.value);
        const maxR = parseFloat(rInput.max);
        const pixelsAvailable = canvas.width - 150;
        entities.e2.x = entities.e1.x + (r / maxR) * pixelsAvailable;
        entities.e2.y = entities.e1.y;
        drawPhysics();
    }

    function updateRFromPositions() {
        const dx = entities.e2.x - entities.e1.x;
        const dy = entities.e2.y - entities.e1.y;
        const distPixels = Math.hypot(dx, dy);
        
        const maxR = parseFloat(rInput.max);
        const pixelsAvailable = canvas.width - 150;
        
        let newR = (distPixels / pixelsAvailable) * maxR;
        if (newR < parseFloat(rInput.min)) newR = parseFloat(rInput.min);
        
        rInput.value = newR.toFixed(2);
        rNum.value = newR.toFixed(2);
    }

    function updateLabels() {
        const scenario = scenarioSelect.value;
        populateUnits();
        
        if (scenario === 'gravedad') {
            lblVal1.innerHTML = `Masa 1 ($m_1$)`;
            lblVal2.innerHTML = `Masa 2 ($m_2$)`;
            v1Input.min = 1; v1Input.max = 10000; v1Input.step = 1;
            v2Input.min = 1; v2Input.max = 10000; v2Input.step = 1;
        } else {
            lblVal1.innerHTML = `Carga 1 ($q_1$)`;
            lblVal2.innerHTML = `Carga 2 ($q_2$)`;
            v1Input.min = 1; v1Input.max = 1000; v1Input.step = 1; v1Num.value = 10; v1Input.value = 10;
            v2Input.min = 1; v2Input.max = 1000; v2Input.step = 1; v2Num.value = 5; v2Input.value = 5;
        }
        
        if(typeof window.MathJax !== 'undefined' && typeof window.MathJax.typesetPromise === 'function') {
            MathJax.typesetPromise([lblVal1, lblVal2, lblDist]).catch(err => console.log(err));
        }
    }

    // interaccion Drag Drop Canvas
    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const ax = e.clientX - rect.left;
        const ay = e.clientY - rect.top;

        if (Math.hypot(ax - entities.e1.x, ay - entities.e1.y) <= entities.e1.radius) {
            draggingEntity = 'e1';
        } else if (Math.hypot(ax - entities.e2.x, ay - entities.e2.y) <= entities.e2.radius) {
            draggingEntity = 'e2';
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (!draggingEntity) return;
        const rect = canvas.getBoundingClientRect();
        const ax = e.clientX - rect.left;
        const ay = e.clientY - rect.top;

        entities[draggingEntity].x = Math.max(entities[draggingEntity].radius, Math.min(canvas.width - entities[draggingEntity].radius, ax));
        entities[draggingEntity].y = Math.max(entities[draggingEntity].radius, Math.min(canvas.height - entities[draggingEntity].radius, ay));

        updateRFromPositions();
        drawPhysics();
        fetchPhysicsData();
    });

    window.addEventListener('mouseup', () => draggingEntity = null);

    function drawPhysics() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const scenario = scenarioSelect.value;
        const rText = rNum.value;
        
        entities.e1.radius = calcRadius(parseFloat(v1Num.value), true);
        entities.e2.radius = calcRadius(parseFloat(v2Num.value), false);

        const ex1 = entities.e1.x; const ey1 = entities.e1.y;
        const ex2 = entities.e2.x; const ey2 = entities.e2.y;

        ctx.beginPath();
        ctx.moveTo(ex1, ey1);
        ctx.lineTo(ex2, ey2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke(); ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(ex1, ey1, entities.e1.radius, 0, Math.PI * 2);
        ctx.fillStyle = scenario === 'gravedad' ? '#f472b6' : '#38bdf8';
        ctx.shadowBlur = 15; ctx.shadowColor = ctx.fillStyle;
        ctx.fill(); ctx.fill(); ctx.shadowBlur = 0;
        
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '12px Inter';
        ctx.fillText(scenario === 'gravedad' ? 'M1' : 'Q1', ex1, ey1);

        ctx.beginPath();
        ctx.arc(ex2, ey2, entities.e2.radius, 0, Math.PI * 2);
        ctx.fillStyle = scenario === 'gravedad' ? '#fb7185' : '#818cf8';
        ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle;
        ctx.fill(); ctx.fill(); ctx.shadowBlur = 0;
        
        ctx.fillStyle = 'white';
        ctx.fillText(scenario === 'gravedad' ? 'M2' : 'Q2', ex2, ey2);

        const midX = ex1 + (ex2 - ex1) / 2;
        const midY = ey1 + (ey2 - ey1) / 2;
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`r = ${rText} ${rUnit.value}`, midX, midY - 15);
    }

    function initChart() {
        const ctxChart = document.getElementById('physics-chart').getContext('2d');
        physicsChart = new Chart(ctxChart, {
            type: 'line',
            data: {
                labels: [], 
                datasets: [{
                    label: 'Fuerza (N)', data: [],
                    borderColor: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.1)',
                    borderWidth: 2, fill: true, tension: 0.4,
                    pointRadius: 0, pointHoverRadius: 6
                },
                {
                    label: 'Punto Actual', data: [], 
                    borderColor: '#f472b6', backgroundColor: '#f472b6',
                    pointRadius: 6, showLine: false
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, color: '#f8fafc',
                scales: {
                    x: { title: { display: true, text: 'Distancia Eje X Arbitrario', color: '#94a3b8' } },
                    y: { 
                        title: { display: true, text: 'Fuerza F (N)', color: '#94a3b8' }, 
                        type: 'logarithmic',
                        ticks: {
                            color: '#94a3b8',
                            callback: function(value) {
                                return value.toExponential(2);
                            }
                        }
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    function updateChartCurve() {
        const scenario = scenarioSelect.value;
        const v1 = parseFloat(v1Num.value) * CONVERSIONS[v1Unit.value];
        const v2 = parseFloat(v2Num.value) * CONVERSIONS[v2Unit.value];
        const multiplierR = CONVERSIONS[rUnit.value];

        // Usar los limites crudos del slider de R para la generacion visual del chart (de 1 a max min)
        const maxR = parseFloat(rInput.max);
        const labels = [];
        const dataOriginal = [];
        
        let constant = scenario === 'gravedad' ? 6.67430e-11 : 8.9875517923e9;
        
        for(let rd = 1; rd <= maxR; rd += 0.5) {
            labels.push(rd);
            let rd_meters = rd * multiplierR;
            dataOriginal.push(constant * (v1 * v2) / (rd_meters * rd_meters));
        }

        if (physicsChart && physicsChart.data) {
            physicsChart.data.labels = labels;
            physicsChart.data.datasets[0].data = dataOriginal;
            physicsChart.update();
        }
    }

    async function fetchPhysicsData() {
        const scen = scenarioSelect.value;
        
        // Convert to Standard SI Units for the BE Call
        const v1_real = parseFloat(v1Num.value) * CONVERSIONS[v1Unit.value];
        const v2_real = parseFloat(v2Num.value) * CONVERSIONS[v2Unit.value];
        const r_real = parseFloat(rNum.value) * CONVERSIONS[rUnit.value];

        try {
            const url = `/api/inverso-cuadrado/calcular?tipo=${scen}&valor1=${encodeURIComponent(v1_real)}&valor2=${encodeURIComponent(v2_real)}&r=${encodeURIComponent(r_real)}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            formulaText.innerHTML = `$$ ${data.formula_str} $$`;
            if(typeof window.MathJax !== 'undefined' && typeof window.MathJax.typesetPromise === 'function') {
                MathJax.typesetPromise([formulaText]).catch(e => {});
            }

            resultH2.innerText = data.fuerza_newtons.toExponential(4) + ' N';

            // Chart update protegido
            if (physicsChart && physicsChart.data) {
                const currentRRaw = parseFloat(rNum.value);
                const pointData = physicsChart.data.labels.map(label_r => {
                    if (Math.abs(label_r - currentRRaw) < 0.26) return data.fuerza_newtons;
                    return null;
                });
                physicsChart.data.datasets[1].data = pointData;
                physicsChart.update();
            }

        } catch(e) {
            console.error("API Error", e);
        }
    }

    scenarioSelect.addEventListener('change', () => { setTimeout(() => { updateLabels(); updatePositionsFromR(); updateChartCurve(); fetchPhysicsData(); }, 50) });

    updateLabels();
    initChart();
    setTimeout(() => {
        resizeCanvas();
        updateChartCurve();
        fetchPhysicsData();
    }, 150);
});
