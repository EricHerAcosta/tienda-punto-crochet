document.addEventListener('DOMContentLoaded', () => {

    // Inputs Master
    const tensionNum = document.getElementById('tension-num');
    const tensionSlider = document.getElementById('tension-slider');
    
    const bNum = document.getElementById('b-num');
    const bSlider = document.getElementById('b-slider');

    // Toggles Master
    const modeToggle = document.getElementById('mode-toggle');
    const showRadioToggle = document.getElementById('show-radio-toggle');

    // Paneles a conmutar
    const panelExplorador = document.getElementById('telemetry-explorador');
    const panelLaboratorio = document.getElementById('panel-laboratorio');
    
    // Telemetria Outputs
    const tRadio = document.getElementById('t-radio');
    
    // Lab Controls
    const labInput = document.getElementById('lab-input');
    const btnVerificar = document.getElementById('btn-verificar');
    const btnResolver = document.getElementById('btn-resolver');
    const labFeedback = document.getElementById('lab-feedback');

    // Modales Dinamicos
    const solutionModal = document.getElementById('solution-modal');
    const closeSolution = document.getElementById('close-solution');
    const closeSolutionBtn = document.getElementById('close-solution-btn');
    const solV = document.getElementById('sol-v');
    const solB = document.getElementById('sol-b');
    const solR = document.getElementById('sol-r');
    const solFinal = document.getElementById('sol-final');

    // Constantes Reales Físicas
    const EM_REAL = 1.75882e11; // Constante Universal: 1.75882 * 10^11 C/kg
    const SCALE_PX = 3000; // Factor local: 1 Metro = 3000 Px (Ej: 5cm = 0.05 * 3000 = 150px)

    let currentRadiusMeters = 0;
    
    // Sincronización UI V y B
    function syncInputs(numElement, sliderElement, max) {
        sliderElement.addEventListener('input', () => {
            numElement.value = sliderElement.value;
        });
        numElement.addEventListener('change', () => {
            let val = parseFloat(numElement.value);
            sliderElement.value = Math.min(Math.max(val, parseFloat(sliderElement.min)), parseFloat(sliderElement.max));
        });
    }
    syncInputs(tensionNum, tensionSlider);
    syncInputs(bNum, bSlider);

    // Sistema Analítico Principal
    function getRadius() {
        const V = parseFloat(tensionSlider.value); // Voltios
        const B = parseFloat(bSlider.value) * 1e-3; // de mT a Tesla
        // Radio r = sqrt( 2*V / (B^2 * e/m) )
        const r = Math.sqrt( (2 * V) / (Math.pow(B, 2) * EM_REAL) );
        return r;
    }

    // Modo Toggle Logic
    modeToggle.addEventListener('change', () => {
        if(modeToggle.checked) {
            // Entramos a MODO LABORATORIO
            panelExplorador.style.display = 'none';
            panelLaboratorio.style.display = 'block';
            labFeedback.style.display = 'none';
            labInput.value = '';
        } else {
            // MODO EXPLORACIÓN NORMAL
            panelExplorador.style.display = 'block';
            panelLaboratorio.style.display = 'none';
        }
    });

    // Validación del Reto Lógico
    btnVerificar.addEventListener('click', () => {
        const userInput = parseFloat(labInput.value);
        if(isNaN(userInput)) {
            labFeedback.innerHTML = "Intenta un número. Ejemplo: 1.75";
            labFeedback.style.color = "#f87171";
            labFeedback.style.display = "block";
            return;
        }
        
        // Comprobar margen de tolerancia 5% => (1.67 a 1.84)
        const target = 1.758; // x10^11
        const error = Math.abs(target - userInput) / target;
        
        labFeedback.style.display = "block";
        if(error <= 0.05) {
            labFeedback.innerHTML = "¡EXACTO! Has logrado 'Pesar' al primer electrón tal cual J.J. Thomson. (Error < 5%)";
            labFeedback.style.color = "#4ade80";
        } else {
            labFeedback.innerHTML = `Fallaste. Hay un error matemático. Ayuda: ( e/m = 2V / B²r² ). Revisa que el Radio esté en Metros (no cms) y el Campo en Teslas (no mT).`;
            labFeedback.style.color = "#f472b6";
        }
    });

    // Sistema Solucionario 💡
    btnResolver.addEventListener('click', () => {
        const V = parseFloat(tensionSlider.value);
        const B = parseFloat(bSlider.value) * 1e-3; // Tesla
        const r = currentRadiusMeters;

        // Inyectar datos al HTML
        solV.innerText = V.toString();
        solB.innerText = B.toExponential(2);
        solR.innerText = r.toFixed(4);

        // Operacion
        const calcVal = (2 * V) / (Math.pow(B, 2) * Math.pow(r, 2));
        const mantissa = calcVal / 1e11;

        solFinal.innerHTML = `$$ \frac{e}{m_e} = ${mantissa.toFixed(4)} \times 10^{11} \text{ C/kg} $$`;

        solutionModal.style.display = 'flex';
        if(window.MathJax) {
            MathJax.typesetPromise([solFinal]).catch(()=>{});
        }
    });

    closeSolution.addEventListener('click', () => solutionModal.style.display = 'none');
    closeSolutionBtn.addEventListener('click', () => solutionModal.style.display = 'none');

    const exTitle = document.getElementById('ex-title');
    const exDesc = document.getElementById('ex-desc');

    // Ejemplos Pedagógicos
    document.getElementById('btn-ejemplo1').addEventListener('click', () => {
        tensionNum.value = 150; tensionSlider.value = 150;
        bNum.value = 1.5; bSlider.value = 1.5;
        if(typeof window.openTab === 'function') window.openTab('resultados');
        
        exTitle.innerText = "Ejemplo 1: Configuración Clásica (Tubo J.J. Thomson)";
        exDesc.innerHTML = "Hemos configurado el tubo con una <b>tensión aceleradora de $150$ V</b> y un <b>campo magnético de $1.5$ mT</b>. Bajo estos parámetros controlados obtendrás un haz circular con un radio de aproximadamente <b>$3.37$ cm</b>.<br><br>" +
            "Fue exactamente bajo estas métricas estables donde los pioneros del Laboratorio Cavendish en Cambridge lograron inferir por primera vez la constante universal del electrón:<br><br>" +
            "$$ \\frac{e}{m_e} = \\frac{2 \\times 150}{(1.5 \\times 10^{-3})^2 \\times (0.0337)^2} \\approx 1.758 \\times 10^{11} \\text{ C/kg} $$<br>" +
            "Observa cómo al mover $V$ la órbita crece (más energía cinética), y al subir $B$ la órbita se comprime (mayor fuerza centrípeta magnética). La competencia entre ambas define el radio exacto.";
        infoModal.style.display = 'flex';
        if(window.MathJax) MathJax.typesetPromise([exDesc]).catch(e => {});
    });

    document.getElementById('btn-ejemplo2').addEventListener('click', () => {
        tensionNum.value = 50; tensionSlider.value = 50;
        bNum.value = 0.55; bSlider.value = 0.55;
        if(typeof window.openTab === 'function') window.openTab('resultados');
        
        exTitle.innerText = "Ejemplo 2: Magnetismo Terrestre";
        exDesc.innerHTML = "Hemos calibrado la simulación con una tensión suave de <b>$50$ V</b> y un campo magnético débil de <b>$0.55$ mT</b>, comparable al campo magnético natural de la Tierra ($\\approx 0.05$ mT en la superficie).<br><br>" +
            "A pesar de lo minúsculo de este campo, observa que aún es capaz de desviar al electrón imponiendo un radio enorme de aproximadamente <b>$13$ cm</b>. Esto se debe a la masa increíblemente pequeña del electrón ($m_e = 9.109 \\times 10^{-31}$ kg).<br><br>" +
            "Este ejemplo ilustra por qué los rayos cósmicos (partículas cargadas de alta velocidad) son curvados por el campo magnético terrestre, formando los cinturones de Van Allen que protegen al planeta.";
        infoModal.style.display = 'flex';
        if(window.MathJax) MathJax.typesetPromise([exDesc]).catch(e => {});
    });

    // SISTEMA MOTOR DE CANVAS
    const canvas = document.getElementById('bulb-canvas');
    const ctx = canvas.getContext('2d');
    let angle = 0;

    function drawBulbGrid(cx, cy) {
        // Red Grid de Referencia Real (como la impresión en el vidrio del experimento real)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = 1;

        // Dibujar aros referenciales desde 2cm hasta 10cm
        for(let cm = 2; cm <= 10; cm+=2) {
            ctx.beginPath();
            let radiopx = (cm / 100) * SCALE_PX;
            ctx.arc(cx, cy, radiopx, 0, Math.PI * 2);
            ctx.stroke();
            
            // Textos de Medida Centimétrica Inferiores
            ctx.fillStyle = "rgba(255,255,255,0.4)";
            ctx.font = "11px Inter";
            ctx.fillText(`${cm} cm`, cx - 12, cy + radiopx + 14);
        }

        // Cruz Base
        ctx.beginPath();
        ctx.moveTo(cx - 300, cy); ctx.lineTo(cx + 300, cy);
        ctx.moveTo(cx, cy - 300); ctx.lineTo(cx, cy + 300);
        ctx.stroke();
    }

    function animate() {
        requestAnimationFrame(animate);

        // Resize Reactivo Básico: Posicionamiento absoluto para prevenir stretching loop
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';

        const rect = canvas.parentElement.getBoundingClientRect();
        if(canvas.width !== rect.width || canvas.height !== rect.height) {
            canvas.width = rect.width;
            canvas.height = rect.height;
        }

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        ctx.clearRect(0, 0, canvas.width, canvas.height); // Borrado Total por frame

        drawBulbGrid(cx, cy);

        // Update Physics
        currentRadiusMeters = getRadius();
        let rPx = currentRadiusMeters * SCALE_PX;

        // Limita explosiones destructivas del dibujo (si sale de 300px)
        const renderR = Math.min(rPx, cx * 0.95); // Límite visual de la ampolla

        // DIBUJAR PISTA DE GAS (Anillo Fosforescente Estático Fijo)
        ctx.beginPath();
        ctx.arc(cx, cy, renderR, 0, Math.PI * 2);
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(56, 189, 248, 0.4)"; // Cyan Gaseoso Translucido
        // Sombras glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#38bdf8";
        ctx.stroke();
        ctx.shadowBlur = 0; // reset

        // DIBUJAR ELECTRÓN VIAJERO (Pellet Brillante sobre el riel)
        angle += 0.05; // Velocidad cinemática de la animación pseudo real
        
        let elX = cx + renderR * Math.cos(angle);
        let elY = cy + renderR * Math.sin(angle);

        ctx.beginPath();
        ctx.arc(elX, elY, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#ffffff";
        ctx.fill();
        ctx.shadowBlur = 0; // reset

        // TOGGLE: Dibujar Cinta Métrica Virtual
        if(showRadioToggle.checked) {
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(elX, elY);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 5]); // Linea punteada topográfica
            ctx.stroke();
            ctx.setLineDash([]); // Reset
            
            // Punto central origen
            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, Math.PI*2);
            ctx.fillStyle = "#f472b6";
            ctx.fill();
        }

        // --- ACTUALIZAR TELEMETRÍA DIGITAL EXPLORATORIA ---
        if(!modeToggle.checked) {
            // Esta string estático cambiará cada cuadro
            const newRM = currentRadiusMeters.toFixed(4); // radio real metros
            const newRCM = (currentRadiusMeters * 100).toFixed(2); // cms

            // Truco reactivo: solo re-dibijamos local HTML puro para evadir matar el MathJax V8 Render
            // Hacemos el span que vive directo en el DOM para inyectarle.
            // Para MathJax fluido: Mejor cambiamos string puro pero SIN Typeset para iteraciones de 60 FPS
            // Ya que si pasas Typeset a 60FPS explota la maquina.
            tRadio.innerHTML = `Radio Actual: <b>${newRCM}</b> cm (ó ${newRM} m)`;
            // (La Notación Avanzada se omite por latencia de frame ya que iteramos 60 veces por seg).
        }
    }

    // SISTEMA ESQUEMA MONTAJE INSTRUMENTAL (Canvas Secundario)
    const ecanvas = document.getElementById('esquema-canvas');
    if(ecanvas) {
        ecanvas.style.position = 'absolute';
        ecanvas.style.top = '0';
        ecanvas.style.left = '0';

        const ectx = ecanvas.getContext('2d');
        function drawMontaje() {
            const rx = ecanvas.parentElement.getBoundingClientRect();
            if(ecanvas.width !== rx.width || ecanvas.height !== rx.height) {
                ecanvas.width = rx.width; ecanvas.height = rx.height;
            }
            ectx.clearRect(0,0, ecanvas.width, ecanvas.height);
            const w = ecanvas.width; const h = ecanvas.height;
            const cx = w/2; const cy = h/2;

            // Tubo de vidrio (Cápsula esférica 3D style)
            ectx.beginPath();
            ectx.arc(cx, cy, Math.min(w,h)*0.35, 0, Math.PI*2);
            ectx.fillStyle = 'rgba(56, 189, 248, 0.05)';
            ectx.fill();
            ectx.strokeStyle = 'rgba(255,255,255,0.2)'; ectx.lineWidth = 2; ectx.stroke();

            // Bobinas Helmholtz (Óvalos isométricos traseros y frontales)
            // Bobina Trasera
            ectx.beginPath();
            ectx.ellipse(cx - 30, cy, Math.min(w,h)*0.1, Math.min(w,h)*0.4, 0, 0, Math.PI*2);
            ectx.strokeStyle = '#f472b6'; ectx.lineWidth = 4; ectx.stroke();
            // Bobina Frontal
            ectx.beginPath();
            ectx.ellipse(cx + 30, cy, Math.min(w,h)*0.1, Math.min(w,h)*0.4, 0, 0, Math.PI*2);
            ectx.strokeStyle = 'rgba(244, 114, 182, 0.7)'; ectx.lineWidth = 6; ectx.stroke();

            // Cañón de Electrones
            ectx.beginPath();
            ectx.rect(cx - 150, cy - 20, 80, 40);
            ectx.fillStyle = '#94a3b8'; ectx.fill();
            ectx.fillStyle = '#fff'; ectx.font = '12px Inter'; ectx.fillText("CAÑÓN e-", cx - 140, cy + 5);
            // Filamento / Cable
            ectx.beginPath(); ectx.moveTo(cx-150,cy); ectx.lineTo(cx-200,cy); ectx.strokeStyle='#fff'; ectx.lineWidth=2; ectx.stroke();

            // Haz de electrones simulado estático
            ectx.beginPath();
            ectx.arc(cx+20, cy+20, 60, Math.PI, Math.PI*2.5);
            ectx.strokeStyle = '#38bdf8'; ectx.lineWidth = 3; ectx.stroke();

            // Texto guía
            ectx.fillStyle = 'rgba(255,255,255,0.6)';
            ectx.font = '14px Inter';
            ectx.fillText("1. Filamento acelera as de electrones (Gas Argón)", 20, h - 60);
            ectx.fillText("2. Bobinas frontales/traseras generan campo magnetico cruzado B", 20, h - 40);
            ectx.fillText("3. Fueza de Lorentz orbita la partícula limitando su escape", 20, h - 20);

            requestAnimationFrame(drawMontaje);
        }
        requestAnimationFrame(drawMontaje);
    }

    // Modal Control Central
    const tutorialModal = document.getElementById('tutorial-modal');
    const infoModal = document.getElementById('example-modal'); // Info general
    
    document.getElementById('btn-tutorial')?.addEventListener('click', () => {
        tutorialModal.style.display = 'flex';
        if(window.MathJax) MathJax.typesetPromise([tutorialModal]).catch(e => {});
    });
    document.getElementById('close-modal')?.addEventListener('click', () => tutorialModal.style.display = 'none');
    
    document.getElementById('btn-info-chart')?.addEventListener('click', () => {
        exTitle.innerText = "Interpretar: Cámara de Vacío y Haz Circular";
        exDesc.innerHTML = "<ul style='text-align: left; font-size: 0.95rem; margin-left: 10px; list-style: disc;'>" +
            "<li>Los <b>anillos concéntricos</b> grabados en la ampolla representan la rejilla métrica real del tubo de haz fino. Cada aro indica una distancia conocida ($2$ cm, $4$ cm, etc.) desde el centro del cañón.</li>" +
            "<li>La <b>estela circular celeste</b> simula la fosforescencia del gas Argón al ser ionizado por el paso de los electrones. En el laboratorio real, esta luz azulada es lo que permite medir el radio $r$ visualmente.</li>" +
            "<li>El <b>punto blanco</b> que orbita representa un electrón individual siendo curvado por la Fuerza de Lorentz ($F = qvB$), perpendicular a su velocidad.</li>" +
            "<li>La <b>línea punteada</b> (si está activada) conecta el centro con el electrón, mostrando el radio instantáneo $r$ que necesitas para calcular $e/m_e$.</li></ul>";
        infoModal.style.display = 'flex';
        if(window.MathJax) MathJax.typesetPromise([exDesc]).catch(e => {});
    });
    document.getElementById('close-example')?.addEventListener('click', () => infoModal.style.display = 'none');
    document.getElementById('close-example-btn')?.addEventListener('click', () => infoModal.style.display = 'none');

    // Cierre con click exterior
    window.addEventListener('click', (e) => {
        if(e.target === tutorialModal) tutorialModal.style.display = 'none';
        if(e.target === infoModal) infoModal.style.display = 'none';
        if(e.target === solutionModal) solutionModal.style.display = 'none';
    });

    // Iniciar ignición
    animate();

});
