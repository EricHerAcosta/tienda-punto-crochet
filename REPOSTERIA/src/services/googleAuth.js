/**
 * Servicio de Autenticación Google OAuth 2.0 utilizando Google Identity Services (GIS)
 */

const STORAGE_KEY_TOKEN = 'reposteria_google_token';
const STORAGE_KEY_CLIENT_ID = 'reposteria_client_id';
const STORAGE_KEY_USER = 'reposteria_user';
const STORAGE_KEY_PIN = 'reposteria_security_pin';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
].join(' ');

let tokenClient = null;

export const googleAuthService = {
  /**
   * Obtiene el PIN de seguridad de 4 dígitos (por defecto '1234')
   */
  getPin() {
    return localStorage.getItem(STORAGE_KEY_PIN) || '1234';
  },

  /**
   * Establece un nuevo PIN de 4 dígitos
   */
  setPin(pin) {
    if (pin && String(pin).trim().length === 4) {
      localStorage.setItem(STORAGE_KEY_PIN, String(pin).trim());
      return true;
    }
    return false;
  },

  /**
   * Verifica si el PIN proporcionado coincide con el guardado
   */
  verifyPin(inputPin) {
    const currentPin = this.getPin();
    return String(inputPin).trim() === String(currentPin).trim();
  },

  /**
   * Obtiene el Client ID almacenado o usa la variable de entorno
   */
  getClientId() {
    return localStorage.getItem(STORAGE_KEY_CLIENT_ID) || import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  },

  /**
   * Establece un nuevo Client ID y lo conserva fijamente en localStorage
   */
  setClientId(clientId) {
    if (clientId) {
      localStorage.setItem(STORAGE_KEY_CLIENT_ID, clientId.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_CLIENT_ID);
    }
  },

  /**
   * Inicializa el cliente OAuth 2.0 de Google Identity Services
   */
  init(onSuccess, onError) {
    const clientId = this.getClientId();
    if (!clientId) {
      console.warn('[GoogleAuth] No hay Client ID configurado.');
      return false;
    }

    if (typeof window.google === 'undefined' || !window.google.accounts || !window.google.accounts.oauth2) {
      console.warn('[GoogleAuth] Google Identity Services SDK no cargado aún.');
      return false;
    }

    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: async (response) => {
          if (response.error) {
            console.error('[GoogleAuth] Error en respuesta de autenticación:', response);
            if (onError) onError(response.error);
            return;
          }

          const expiryTime = Date.now() + (response.expires_in * 1000);
          const tokenData = {
            access_token: response.access_token,
            expires_at: expiryTime
          };

          localStorage.setItem(STORAGE_KEY_TOKEN, JSON.stringify(tokenData));

          // Fetch user info
          try {
            const userInfo = await this.fetchUserProfile(response.access_token);
            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(userInfo));
            if (onSuccess) onSuccess({ token: tokenData, user: userInfo });
          } catch (err) {
            console.error('[GoogleAuth] Error al obtener perfil de usuario:', err);
            if (onSuccess) onSuccess({ token: tokenData, user: { email: 'usuario@gmail.com' } });
          }
        },
      });

      return true;
    } catch (error) {
      console.error('[GoogleAuth] Error al inicializar TokenClient:', error);
      if (onError) onError(error);
      return false;
    }
  },

  /**
   * Dispara el flujo modal de autorización de Google
   */
  login() {
    if (!tokenClient) {
      const initialized = this.init();
      if (!initialized) {
        throw new Error('Por favor configura un Client ID de Google válido en la sección de Configuración.');
      }
    }
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    }
  },

  /**
   * Cierra sesión y remueve tokens almacenados
   */
  logout() {
    const token = this.getToken();
    if (token && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(token, () => {
        console.log('[GoogleAuth] Token revocado.');
      });
    }
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
  },

  /**
   * Obtiene el token de acceso actual si sigue válido
   */
  getToken() {
    const raw = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (!raw) return null;
    try {
      const tokenData = JSON.parse(raw);
      if (Date.now() >= tokenData.expires_at - 60000) {
        // Expirado o a punto de expirar
        return null;
      }
      return tokenData.access_token;
    } catch (e) {
      return null;
    }
  },

  /**
   * Retorna si hay un usuario autenticado
   */
  isLoggedIn() {
    return !!this.getToken();
  },

  /**
   * Obtiene los datos del usuario activo
   */
  getUser() {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  /**
   * Obtiene la información del perfil del usuario usando el Token de Acceso
   */
  async fetchUserProfile(accessToken) {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error('No se pudo obtener el perfil de usuario');
    return await res.json();
  }
};
