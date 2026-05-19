document.addEventListener('DOMContentLoaded', () => {

    const tempNum = document.getElementById('temperatura-num');
    const tempSlider = document.getElementById('temperatura-slider');
    
    const tLambdaMax = document.getElementById('t-lambda-max');
    const tPotencia = document.getElementById('t-potencia');

    let chartPlanck = null;
    let showClassical = false;

    // Sincronización de inputs
    tempSlider.addEventListener('input', () => {
        tempNum.value = tempSlider.value;
        showClassical = false; // Se oculta al mover
        triggerCalculation();
    });

    tempNum.addEventListener('change', () => {
        tempSlider.value = Math.min(Math.max(tempNum.value, 100), 15000);
        showClassical = false;
        triggerCalculation();
    });

    // Constantes Universales
    const h = 6.62607015e-34; // J s
    const c = 299792458; // m / s
    const kB = 1.380649e-23; // J / K
    const sigma = 5.670374419e-8; // W / m^2 K^4
    const bWien = 2.897771955e-3; // m K

    // Función: Planck's Law
    // B(lambda, T) = (2hc^2 / lambda^5) * 1 / (exp(hc / lambda k_B T) - 1)
    // Devuelve W / (sr m^3), lo escalaremos para visualización (dividir por 1e12 o similar).
    function calcPlanck(nm, T) {
        const lambda = nm * 1e-9;
        const term1 = (2 * h * c * c) / Math.pow(lambda, 5);
        const term2 = Math.exp((h * c) / (lambda * kB * T)) - 1;
        const radiance = term1 / term2;
        // Escalamos por conveniencia visual en JS general 1e-12
        return radiance * 1e-12; 
    }

    // Función: Rayleigh-Jeans
    // B(lambda, T) = (2c k_B T) / lambda^4
    function calcClassical(nm, T) {
        const lambda = nm * 1e-9;
        const radiance = (2 * c * kB * T) / Math.pow(lambda, 4);
        return radiance * 1e-12;
    }

    function initCharts() {
        const ctxP = document.getElementById('chart-planck').getContext('2d');

        // Plugin Arcoiris para Espectro Visible (380 - 700 nm)
        const specterPlugin = {
            id: 'specterBackground',
            beforeDraw: (chart) => {
                const ctx = chart.ctx;
                const xAxis = chart.scales.x;
                const yAxis = chart.scales.y;
                
                const x380 = xAxis.getPixelForValue(380);
                const x700 = xAxis.getPixelForValue(700);
            
                const gradient = ctx.createLinearGradient(x380, 0, x700, 0);
                gradient.addColorStop(0, 'rgba(138, 43, 226, 0.25)'); // violet
                gradient.addColorStop(0.2, 'rgba(0, 0, 255, 0.25)'); // blue
                gradient.addColorStop(0.4, 'rgba(0, 255, 0, 0.25)'); // green
                gradient.addColorStop(0.6, 'rgba(255, 255, 0, 0.25)'); // yellow
                gradient.addColorStop(0.8, 'rgba(255, 127, 0, 0.25)'); // orange
                gradient.addColorStop(1, 'rgba(255, 0, 0, 0.25)'); // red
            
                ctx.save();
                const left = Math.max(xAxis.left, x380);
                const right = Math.min(xAxis.right, x700);
                if(right > left && left >= xAxis.left) { // Control bounds
                    ctx.fillStyle = gradient;
                    ctx.fillRect(left, yAxis.top, right - left, yAxis.bottom - yAxis.top);
                    
                    // Text
                    ctx.fillStyle = "rgba(255,255,255,0.4)";
                    ctx.font = "10px Inter";
                    ctx.fillText("ESPECTRO VISIBLE", left + 10, yAxis.top + 15);
                }
                ctx.restore();
            }
        };

        chartPlanck = new Chart(ctxP, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Ley de Planck (Cuántica)',
                        data: [],
                        borderColor: '#38bdf8',
                        backgroundColor: 'rgba(56, 189, 248, 0.2)',
                        borderWidth: 2,
                        fill: true,
                        pointRadius: 0,
                        tension: 0.4
                    },
                    {
                        label: 'Rayleigh-Jeans (Clásica)',
                        data: [],
                        borderColor: '#f87171',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        pointRadius: 0,
                        tension: 0.4,
                        hidden: true // Start hidden
                    },
                    {
                        label: 'Pico λ_max (Wien)',
                        data: [], // Contendrá un sólo punto
                        backgroundColor: '#fff',
                        borderColor: '#fff',
                        pointRadius: 6,
                        pointHoverRadius: 8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                color: '#f8fafc',
                interaction: {
                    mode: 'nearest',
                    intersect: false,
                },
                scales: {
                    x: {
                        type: 'linear',
                        min: 100,
                        max: 3000,
                        title: { display: true, text: 'Longitud de Onda λ (nm)', color: '#94a3b8' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Radiancia Espectral (Escalada)', color: '#94a3b8' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                },
                plugins: {
                    legend: { labels: { color: '#f8fafc' } }
                }
            },
            plugins: [specterPlugin]
        });
    }

    // Color mapper from K to RGB approximated
    function KtoRGB(Kelvin) {
        let temp = Kelvin / 100;
        let r, g, b;

        if (temp <= 66) {
            r = 255;
            g = temp;
            g = 99.4708025861 * Math.log(g) - 161.1195681661;
            if (temp <= 19) b = 0;
            else {
                b = temp - 10;
                b = 138.5177312231 * Math.log(b) - 305.0447927307;
            }
        } else {
            r = temp - 60;
            r = 329.698727446 * Math.pow(r, -0.1332047592);
            g = temp - 60;
            g = 288.1221695283 * Math.pow(g, -0.0755148492);
            b = 255;
        }

        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));

        return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
    }

    function renderStar(colorObj) {
        const canvas = document.getElementById('star-canvas');
        const ctx = canvas.getContext('2d');
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const rColor = `rgba(${colorObj.r}, ${colorObj.g}, ${colorObj.b}, 1)`;
        const glowColor = `rgba(${colorObj.r}, ${colorObj.g}, ${colorObj.b}, 0.2)`;

        // Halo
        const gradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, 120);
        gradient.addColorStop(0, rColor);
        gradient.addColorStop(0.3, glowColor);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Core
        ctx.beginPath();
        ctx.arc(cx, cy, 20, 0, 2 * Math.PI, false);
        ctx.fillStyle = '#fff'; // the core is always bright
        ctx.shadowColor = rColor;
        ctx.shadowBlur = 30;
        ctx.fill();
        ctx.shadowBlur = 0; // reset
    }

    function triggerCalculation() {
        const T = parseFloat(tempNum.value);
        if(!chartPlanck) return;

        // Cálculos Físicos Directos
        const potencia = sigma * Math.pow(T, 4);
        const l_max = (bWien / T) * 1e9; // De metros a nm

        // Update MathJax Telemetria
        let pTxt = "";
        let exponent = Math.floor(Math.log10(potencia));
        let base = (potencia / Math.pow(10, exponent)).toFixed(2);
        
        if(potencia >= 1000) {
            pTxt = `${base} \\times 10^{${exponent}}`;
        } else {
            pTxt = potencia.toFixed(2);
        }

        tLambdaMax.innerHTML = `$$ \\lambda_{max} = ${l_max.toFixed(1)} \\text{ nm} $$`;
        tPotencia.innerHTML = `$$ e_{total} = ${pTxt} \\text{ W/m}^2 $$`;

        if(window.MathJax && window.MathJax.typesetPromise) {
            MathJax.typesetPromise([tLambdaMax, tPotencia]).catch(()=>{});
        }

        // Bucle Matriz (Array) para la Gráfica
        const planckData = [];
        const classicData = [];
        let pPeak = {x: 0, y: 0};
        
        for(let l = 100; l <= 3000; l += 5) {
            let pVal = calcPlanck(l, T);
            let cVal = calcClassical(l, T);
            
            planckData.push({x: l, y: pVal});
            if(showClassical) {
                // To avoid drawing a straight line to infinity disrupting visual limits completely
                if (cVal > pVal * 5) {
                    classicData.push({x: l, y: null}); 
                } else {
                    classicData.push({x: l, y: cVal});
                }
            }

            // Find peak for the point tracker
            if(Math.abs(l - l_max) < 3) {
                pPeak = {x: l, y: pVal};
            }
        }

        chartPlanck.data.datasets[0].data = planckData;
        chartPlanck.data.datasets[1].data = showClassical ? classicData : [];
        chartPlanck.data.datasets[1].hidden = !showClassical;
        
        // Asignar el punto blanco del pico
        // Si el pico es visible en el eje
        if(l_max >= 100 && l_max <= 3000) {
            chartPlanck.data.datasets[2].data = [pPeak];
        } else {
            chartPlanck.data.datasets[2].data = [];
        }

        // Dinámicamente escalar el Eje Y basándose en el pico principal * 1.1!
        const yMaxRender = calcPlanck(l_max, T) * 1.15;
        chartPlanck.options.scales.y.max = yMaxRender;

        chartPlanck.update();

        // Render Star Core Visuals
        const color = KtoRGB(T);
        renderStar(color);
    }

    // --- LÓGICA DE MODALES Y EJEMPLOS ---
    const tutorialModal = document.getElementById('tutorial-modal');
    const exampleModal = document.getElementById('example-modal');
    const exTitle = document.getElementById('ex-title');
    const exDesc = document.getElementById('ex-desc');

    document.getElementById('btn-tutorial').addEventListener('click', () => tutorialModal.style.display = 'flex');
    document.getElementById('close-modal').addEventListener('click', () => tutorialModal.style.display = 'none');
    
    document.getElementById('close-example').addEventListener('click', () => exampleModal.style.display = 'none');
    document.getElementById('close-example-btn').addEventListener('click', () => exampleModal.style.display = 'none');
    
    window.addEventListener('click', (e) => {
        if(e.target === tutorialModal) tutorialModal.style.display = 'none';
        if(e.target === exampleModal) exampleModal.style.display = 'none';
    });

    document.getElementById('btn-info-chart').addEventListener('click', () => {
        exTitle.innerText = "Interpretar Espectrometría: Radiación vs λ";
        exDesc.innerHTML = "<p>Esta gráfica representa cómo un cuerpo despide su energía en forma de Calor/Luz hacia el Universo.</p><br><ul style='text-align: left; font-size: 0.95rem; margin-left: 20px;'><li>El <b>eje $X$</b> indica los \"colores\" de la luz (Longitud de Onda en $nm$). Si la curva sube en el Arcoíris Visual, lograste que el objeto Brille visiblemente para el Ojo Humano.<li>El <b>eje $Y$</b> mide la Irradiancia (Radiancia). La altura de la montaña dicta cuánta furia o poder calórico transmite el rayo.</li><li>El <b>Punto Blanco Mágico</b> persigue milimétricamente la Ecuación de Wien ($\\lambda_{max}$). Te informa cuál es el color que domina absolutamente la explosión calórica que emana del objeto curvo.</li></ul>";
        exampleModal.style.display = 'flex';
        if(window.MathJax) MathJax.typesetPromise([exDesc]).catch(e => {});
    });

    // Preset 1: Sol
    document.getElementById('btn-ejemplo1').addEventListener('click', () => {
        tempNum.value = 5800; tempSlider.value = 5800;
        showClassical = false;
        triggerCalculation();
        
        exTitle.innerText = "Ejemplo 1: Nuestra Estrella (Sol)";
        exDesc.innerHTML = "El Sol, al rondar los $5800$ K, posee una distribución mágica: **Su $\\lambda_{max}$ cae APROX. $500$ nm, exactamente a color Verde/Amarillo!**. Este es el apogeo central del Espectro Visible (la región arcoíris dibujada de fondo). Nuestros ojos terrestres **Evolucionaron para ver ahí**, justamente donde el sol vomita estadísticamente el máximo de su Energía de Planck. Absolutamente poético.";
        exampleModal.style.display = 'flex';
        if(window.MathJax) MathJax.typesetPromise([exDesc]).catch(e => {});
    });

    // Preset 2: Humanos
    document.getElementById('btn-ejemplo2').addEventListener('click', () => {
        tempNum.value = 310; tempSlider.value = 310; // 37 Celsius roughly is 310K
        showClassical = false;
        triggerCalculation();
        
        exTitle.innerText = "Ejemplo 2: Piel Humana y el Infrarrojo Lejano";
        exDesc.innerHTML = "Colocamos al Emisor y a las Ecuaciones midiendo un ser humano vivo ($310$ K, o aprox $37^\\circ$ C). Tal como predice Wien, la curva de Radiación tiene su pico estelar oculto pasados los $9000$ nm **(Infrarrojo Térmico muy Lejano)**.<br>Nuestra curva y su energía chocan nulo (cero) en la franja sensible de arcoíris visible. Por tal motivo, los humanos somos oscuros en la noche salvo para serpientes o visores nocturnos calóricos.";
        exampleModal.style.display = 'flex';
        if(window.MathJax) MathJax.typesetPromise([exDesc]).catch(e => {});
    });

    // Preset 3: Catástrofe UV
    document.getElementById('btn-ejemplo3').addEventListener('click', () => {
        tempNum.value = 4000; tempSlider.value = 4000; 
        showClassical = true;
        triggerCalculation();
        
        exTitle.innerText = "Error Histórico: Catástrofe Ultravioleta";
        exDesc.innerHTML = "En color de línea punteada rojiza y rebasando el límite visual, irrumpe en cámara la Ecuación Clásica de **Rayleigh-Jeans**. Observa el horror analítico: Si te mueves a la izquierda buscando menores $\\lambda$ hacia Ultravioleta e Infrarrojo, el Cálculo de Maxwell predice que la curva **Atravesará el techo hacia el Infinito** multiplicando la energía del Universo. <br><br><b>Max Planck</b> la contuvo obligando a la energía a dividirse abruptamente en Escalones ($h \\cdot f$). Así domesticó la infinita fuerza y obligó a la curva celeste a 'agacharse' aterrizando suavemente a Cero en $0$ nm.";
        exampleModal.style.display = 'flex';
        if(window.MathJax) MathJax.typesetPromise([exDesc]).catch(e => {});
    });

    // Init Sequence
    initCharts();
    triggerCalculation();

});
