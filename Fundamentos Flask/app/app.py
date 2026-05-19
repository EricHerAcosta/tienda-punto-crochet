from flask import Flask
from routes.main_routes import main_bp
from routes.inverso_cuadrado_routes import inverso_cuadrado_bp
from routes.efecto_fotoelectrico_routes import efecto_fotoelectrico_bp

def create_app():
    app = Flask(__name__)
    
    # Registrar Blueprints
    app.register_blueprint(main_bp)
    app.register_blueprint(inverso_cuadrado_bp, url_prefix='/api/inverso-cuadrado')
    app.register_blueprint(efecto_fotoelectrico_bp, url_prefix='/api/fotoelectrico')

    return app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
