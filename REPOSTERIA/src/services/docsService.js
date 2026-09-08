import { googleAuthService } from './googleAuth';
import { driveService } from './driveService';

/**
 * Servicio de Google Docs API v1
 * Almacena procedimientos de recetas y notas en texto enriquecido
 */

const DOCS_API_URL = 'https://docs.googleapis.com/v1/documents';

export const docsService = {
  /**
   * Petición autenticada genérica
   */
  async fetchWithAuth(url, options = {}) {
    const token = googleAuthService.getToken();
    if (!token) throw new Error('Sesión de Google no activa');

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Google Docs API Error: ${err.error?.message || res.statusText}`);
    }
    return res.json();
  },

  /**
   * Crea un nuevo documento en Google Docs para una receta y lo guarda en `/Documentos_Recetas/`
   */
  async createRecipeDocument(recipeName, instructionsText) {
    const { docsId } = await driveService.initFolderStructure();

    // 1. Crear documento en la raíz
    const doc = await this.fetchWithAuth(DOCS_API_URL, {
      method: 'POST',
      body: JSON.stringify({
        title: `Procedimiento: ${recipeName}`
      })
    });

    const docId = doc.documentId;

    // 2. Mover el documento a la subcarpeta Documentos_Recetas en Drive
    const moveUrl = `https://www.googleapis.com/drive/v3/files/${docId}?addParents=${docsId}&fields=id,parents`;
    await driveService.fetchWithAuth(moveUrl, { method: 'PATCH' });

    // 3. Escribir el contenido del procedimiento
    if (instructionsText) {
      await this.updateDocumentContent(docId, instructionsText);
    }

    return docId;
  },

  /**
   * Actualiza el contenido de texto de un documento de receta
   */
  async updateDocumentContent(docId, newText) {
    const requests = [
      {
        insertText: {
          location: { index: 1 },
          text: newText
        }
      }
    ];

    const url = `${DOCS_API_URL}/${docId}:batchUpdate`;
    return await this.fetchWithAuth(url, {
      method: 'POST',
      body: JSON.stringify({ requests })
    });
  },

  /**
   * Obtiene el texto plano de un documento de Google Docs
   */
  async getDocumentText(docId) {
    if (!docId) return '';
    try {
      const url = `${DOCS_API_URL}/${docId}`;
      const doc = await this.fetchWithAuth(url);
      
      let fullText = '';
      if (doc.body && doc.body.content) {
        doc.body.content.forEach(element => {
          if (element.paragraph && element.paragraph.elements) {
            element.paragraph.elements.forEach(elem => {
              if (elem.textRun && elem.textRun.content) {
                fullText += elem.textRun.content;
              }
            });
          }
        });
      }
      return fullText;
    } catch (e) {
      console.error('[DocsService] Error al leer el documento:', e);
      return '';
    }
  }
};
