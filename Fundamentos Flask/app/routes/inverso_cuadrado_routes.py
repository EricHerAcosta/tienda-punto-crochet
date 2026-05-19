from flask import Blueprint, request, jsonify

inverso_cuadrado_bp = Blueprint('inverso_cuadrado_api', __name__)

# Constantes de la Física
G = 6.67430e-11 # Constante de Gravitación Universal (N*(m/kg)^2)
K_E = 8.9875517923e9 # Constante de Coulomb (N*m^2/C^2)

@inverso_cuadrado_bp.route('/calcular', methods=['GET'])
def calcular_fuerza():
    """
    Endpoint para calcular la fuerza usando M1, M2 o Q1, Q2 y la distancia r.
    Espera parámetros por Query String:
    - tipo: 'gravedad' o 'coulomb'
    - valor1: masa 1 o carga 1
    - valor2: masa 2 o carga 2
    - r: distancia en metros
    """
    try:
        tipo = request.args.get('tipo', 'gravedad')
        v1 = float(request.args.get('valor1', 1.0))
        v2 = float(request.args.get('valor2', 1.0))
        r = float(request.args.get('r', 1.0))

        if r <= 0:
            return jsonify({'error': 'La distancia (r) debe ser mayor a 0'}), 400

        res = {'tipo': tipo, 'r': r, 'valor1': v1, 'valor2': v2}

        if tipo == 'gravedad':
            # F = G * (m1 * m2) / r^2
            fuerza = G * (v1 * v2) / (r ** 2)
            res['fuerza_newtons'] = fuerza
            res['formula_str'] = "F = G * (m1 * m2) / r²"
        elif tipo == 'coulomb':
            # F = k_e * (q1 * q2) / r^2
            fuerza = K_E * (v1 * v2) / (r ** 2)
            res['fuerza_newtons'] = fuerza
            res['formula_str'] = "F = k_e * (q1 * q2) / r²"
        else:
            return jsonify({'error': 'Tipo de fuerza inválido. Use "gravedad" o "coulomb"'}), 400
            
        return jsonify(res), 200

    except ValueError:
         return jsonify({'error': 'Parámetros numéricos inválidos'}), 400
    except Exception as e:
         return jsonify({'error': str(e)}), 500
