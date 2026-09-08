import { googleAuthService } from './googleAuth';
import { driveService } from './driveService';

/**
 * Servicio de Google Sheets API v4
 * Base de datos relacional serverless sin costo con soporte bidireccional
 */

const SHEETS_API_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

export const TABS_SCHEMA = {
  Insumos: ['id_insumo', 'nombre', 'unidad_medida', 'stock_actual', 'stock_minimo', 'costo_unidad_promedio'],
  Compras: ['id_compra', 'fecha', 'id_insumo', 'cantidad_comprada', 'precio_total', 'costo_unitario', 'proveedor', 'registrado_por'],
  Recetas: ['id_receta', 'nombre_receta', 'porciones_base', 'doc_id_instrucciones', 'url_foto_drive', 'costo_total_calculado', 'instrucciones'],
  Detalle_Recetas: ['id_detalle', 'id_receta', 'id_insumo', 'cantidad_requerida'],
  Produccion: ['id_produccion', 'fecha', 'id_receta', 'porciones_producidas', 'costo_lote', 'registrado_por']
};

export const sheetsService = {
  /**
   * Petición genérica autenticada a la API de Google Sheets
   */
  async fetchWithAuth(url, options = {}) {
    const token = googleAuthService.getToken();
    if (!token) throw new Error('Sesión de Google no autenticada');

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Google Sheets API Error: ${err.error?.message || res.statusText}`);
    }
    return res.json();
  },

  /**
   * Obtiene o crea el Spreadsheet maestro `Reposteria_DB` en Google Drive
   */
  async getOrCreateSpreadsheet() {
    const { rootId } = await driveService.initFolderStructure();
    
    // Buscar si existe el archivo en la carpeta ReposteriaApp_Data
    const query = `name = 'Reposteria_DB' and mimeType = 'application/vnd.google-apps.spreadsheet' and '${rootId}' in parents and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;
    const searchRes = await driveService.fetchWithAuth(searchUrl);

    if (searchRes.files && searchRes.files.length > 0) {
      return searchRes.files[0].id;
    }

    // Crear nuevo Spreadsheet con las 5 pestañas relacionales
    const sheetsToCreate = Object.keys(TABS_SCHEMA).map(title => ({
      properties: { title }
    }));

    const createPayload = {
      properties: { title: 'Reposteria_DB' },
      sheets: sheetsToCreate
    };

    const spreadsheet = await this.fetchWithAuth(SHEETS_API_URL, {
      method: 'POST',
      body: JSON.stringify(createPayload)
    });

    const spreadsheetId = spreadsheet.spreadsheetId;

    // Mover archivo a la carpeta ReposteriaApp_Data
    const moveUrl = `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?addParents=${rootId}&fields=id,parents`;
    await driveService.fetchWithAuth(moveUrl, { method: 'PATCH' });

    // Escribir cabeceras en cada pestaña
    for (const [tabName, headers] of Object.entries(TABS_SCHEMA)) {
      await this.appendRow(spreadsheetId, tabName, headers);
    }

    return spreadsheetId;
  },

  /**
   * Lee todos los registros de una pestaña y los convierte en objetos JavaScript
   */
  async readSheetData(spreadsheetId, tabName) {
    const url = `${SHEETS_API_URL}/${spreadsheetId}/values/${tabName}!A:Z`;
    const data = await this.fetchWithAuth(url);
    const rows = data.values || [];

    if (rows.length < 2) return [];

    const headers = rows[0];
    return rows.slice(1).map(row => {
      const item = {};
      headers.forEach((header, index) => {
        let val = row[index] !== undefined ? row[index] : '';
        if (val !== '' && !isNaN(val) && header !== 'id_insumo' && header !== 'id_compra' && header !== 'id_receta' && header !== 'id_detalle' && header !== 'id_produccion') {
          val = Number(val);
        }
        item[header] = val;
      });
      return item;
    });
  },

  /**
   * Añade una nueva fila a la pestaña
   */
  async appendRow(spreadsheetId, tabName, rowData) {
    const values = Array.isArray(rowData)
      ? rowData
      : (TABS_SCHEMA[tabName] || []).map(key => rowData[key] !== undefined ? rowData[key] : '');

    const url = `${SHEETS_API_URL}/${spreadsheetId}/values/${tabName}!A1:append?valueInputOption=USER_ENTERED`;
    return await this.fetchWithAuth(url, {
      method: 'POST',
      body: JSON.stringify({
        values: [values]
      })
    });
  },

  /**
   * Actualiza o sobrescribe una fila específica buscando por Llave Primaria (PK)
   */
  async upsertRowByPk(spreadsheetId, tabName, pkField, itemData) {
    const existingRows = await this.readSheetData(spreadsheetId, tabName);
    const headers = TABS_SCHEMA[tabName] || [];
    const pkValue = String(itemData[pkField]);

    const rowIndex = existingRows.findIndex(r => String(r[pkField]) === pkValue);
    const values = headers.map(key => itemData[key] !== undefined ? itemData[key] : '');

    if (rowIndex >= 0) {
      const sheetRowNumber = rowIndex + 2;
      const url = `${SHEETS_API_URL}/${spreadsheetId}/values/${tabName}!A${sheetRowNumber}:Z${sheetRowNumber}?valueInputOption=USER_ENTERED`;
      return await this.fetchWithAuth(url, {
        method: 'PUT',
        body: JSON.stringify({ values: [values] })
      });
    } else {
      return await this.appendRow(spreadsheetId, tabName, itemData);
    }
  },

  /**
   * Elimina una fila específica buscando por Llave Primaria (PK)
   */
  async deleteRowByPk(spreadsheetId, tabName, pkField, pkValue) {
    const existingRows = await this.readSheetData(spreadsheetId, tabName);
    const pkStr = String(pkValue);
    const rowIndex = existingRows.findIndex(r => String(r[pkField]) === pkStr);

    if (rowIndex < 0) {
      console.warn(`[SheetsService] Registro ${pkField}=${pkValue} no encontrado en la pestaña ${tabName}. Ignorando borrado.`);
      return;
    }

    const metaUrl = `${SHEETS_API_URL}/${spreadsheetId}?fields=sheets(properties(sheetId,title))`;
    const metaData = await this.fetchWithAuth(metaUrl);
    const sheet = metaData.sheets?.find(s => s.properties.title === tabName);

    if (!sheet) {
      throw new Error(`No se encontró la pestaña ${tabName} en el Spreadsheet`);
    }

    const sheetId = sheet.properties.sheetId;
    const startIndex = rowIndex + 1;
    const endIndex = rowIndex + 2;

    const batchUrl = `${SHEETS_API_URL}/${spreadsheetId}:batchUpdate`;
    return await this.fetchWithAuth(batchUrl, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: startIndex,
                endIndex: endIndex
              }
            }
          }
        ]
      })
    });
  }
};

