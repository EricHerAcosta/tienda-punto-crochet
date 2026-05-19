from flask import Blueprint, request, jsonify

efecto_fotoelectrico_bp = Blueprint('efecto_fotoelectrico_api', __name__)

HC_EV_NM = 1240.0 # Aproximación pedagógica estándar para hc en eV*nm

@efecto_fotoelectrico_bp.route('/calcular', methods=['GET'])
def calcular_efecto():
    """
    Endpoint para calcular el efecto fotoeléctrico.
    Espera parámetros por Query String:
    - lambda_nm: Longitud de onda de la luz incidente (nm)
    - phi_ev: Función de trabajo del material (eV)
    - voltaje: Voltaje aplicado por la batería externa (V)
    - intensidad: Intensidad de luz (1 a 100)
    """
    try:
        lambda_nm = float(request.args.get('lambda_nm', 400.0))
        phi_ev = float(request.args.get('phi_ev', 2.0))
        voltaje = float(request.args.get('voltaje', 0.0))
        intensidad = float(request.args.get('intensidad', 50.0))

        if lambda_nm <= 0:
            return jsonify({'error': 'La longitud de onda debe ser mayor a 0'}), 400

        # Calcular Energía del Fotón y compararlo
        energia_foton_ev = HC_EV_NM / lambda_nm
        
        # Evaluar emisión
        emite = energia_foton_ev >= phi_ev
        
        if emite:
            k_max_ev = energia_foton_ev - phi_ev
            v_stopping = k_max_ev  # En magnitud (positivo), se requiere un voltaje de -v_stopping para frenar
            
            # Cálculo de corriente relativa (Aproximación pedagógica)
            i_max = intensidad
            if voltaje >= 0:
                # Circuito acelera o es neutral, atrapa todos los electrones (saturación)
                corriente = i_max
            else:
                # Voltaje negativo frena los electrones
                if abs(voltaje) >= v_stopping:
                    corriente = 0.0
                else:
                    # Caída lineal de la corriente (aproximación para el chart)
                    corriente = i_max * (1.0 - (abs(voltaje) / v_stopping))

        else:
            k_max_ev = 0.0
            v_stopping = 0.0
            corriente = 0.0
            
        return jsonify({
            'energia_foton_ev': energia_foton_ev,
            'emite': emite,
            'k_max_ev': k_max_ev,
            'v_stopping': v_stopping,
            'corriente_relativa': corriente,
            'formula_foton': f"E = hc / \\lambda = {energia_foton_ev:.2f} eV",
            'formula_kmax': f"K_{{max}} = E - \\Phi = {k_max_ev:.2f} eV" if emite else "\\text{Sin emisión}"
        }), 200

    except ValueError:
         return jsonify({'error': 'Parámetros numéricos inválidos'}), 400
    except Exception as e:
         return jsonify({'error': str(e)}), 500
