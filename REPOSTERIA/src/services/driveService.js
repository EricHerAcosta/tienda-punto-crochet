import { googleAuthService } from './googleAuth';

/**
 * Servicio de Google Drive API v3
 * Almacena imágenes de recetas y documentos de procedimiento
 */

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

export const driveService = {
  /**
   * Realiza peticiones autenticadas a Google Drive API
   */
  async fetchWithAuth(url, options = {}) {
    const token = googleAuthService.getToken();
    if (!token) throw new Error('No hay sesión de Google activa');

    const headers = {
      Authorization: `Bearer ${token}`,
      ...options.headers
    };

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Google Drive API error: ${err.error?.message || res.statusText}`);
    }
    return res.json();
  },

  /**
   * Busca o crea una carpeta en Google Drive
   */
  async findOrCreateFolder(folderName, parentId = null) {
    let query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    }

    const searchUrl = `${DRIVE_API_URL}?q=${encodeURIComponent(query)}&fields=files(id,name)`;
    const result = await this.fetchWithAuth(searchUrl);

    if (result.files && result.files.length > 0) {
      return result.files[0].id;
    }

    // Crear carpeta si no existe
    const metadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : []
    };

    const createResult = await this.fetchWithAuth(DRIVE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata)
    });

    return createResult.id;
  },

  /**
   * Asegura la existencia de la estructura de carpetas `ReposteriaApp_Data`
   */
  async initFolderStructure() {
    const rootId = await this.findOrCreateFolder('ReposteriaApp_Data');
    const photosId = await this.findOrCreateFolder('Fotos_Recetas', rootId);
    const docsId = await this.findOrCreateFolder('Documentos_Recetas', rootId);

    return { rootId, photosId, docsId };
  },

  /**
   * Sube un archivo de foto (File o Blob) a la carpeta de Google Drive
   */
  async uploadPhoto(file, folderId) {
    const token = googleAuthService.getToken();
    if (!token) throw new Error('No hay sesión activa de Google');

    const metadata = {
      name: `receta_${Date.now()}_${file.name || 'foto.jpg'}`,
      parents: [folderId]
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', file);

    const res = await fetch(UPLOAD_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    if (!res.ok) {
      throw new Error('Error al subir la imagen a Google Drive');
    }

    const data = await res.json();
    return `https://lh3.googleusercontent.com/u/0/d/${data.id}`;
  }
};
