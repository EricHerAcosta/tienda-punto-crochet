from flask import Blueprint, render_template

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def home():
    """
    Ruta raíz de la plataforma. Devuelve el lobby/home
    donde estarán listados los experimentos.
    """
    return render_template('home.html')

@main_bp.route('/simuladores/inverso-cuadrado')
def inverso_cuadrado_view():
    """
    Ruta para la interfaz gráfica del simulador.
    """
    return render_template('simuladores/inverso_cuadrado.html')

@main_bp.route('/simuladores/efecto-fotoelectrico')
def efecto_fotoelectrico_view():
    """
    Ruta para la interfaz gráfica del efecto fotoeléctrico.
    """
    return render_template('simuladores/efecto_fotoelectrico.html')

@main_bp.route('/simuladores/cuerpo-negro')
def cuerpo_negro_view():
    """
    Ruta para la interfaz gráfica del simulador de radiación de cuerpo negro.
    """
    return render_template('simuladores/cuerpo_negro.html')

@main_bp.route('/simuladores/carga-masa')
def carga_masa_view():
    """
    Ruta para la interfaz gráfica del simulador Relación Carga/Masa.
    """
    return render_template('simuladores/carga_masa.html')
