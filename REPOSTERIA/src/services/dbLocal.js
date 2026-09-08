import Dexie from 'dexie';

/**
 * Base de Datos IndexedDB Local utilizando Dexie.js
 * Espejo relacional de Google Sheets + Cola de sincronización Offline
 */
export const db = new Dexie('ReposteriaDB');

db.version(2).stores({
  insumos: 'id_insumo, nombre, unidad_medida, stock_actual, stock_minimo',
  compras: 'id_compra, fecha, id_insumo, proveedor',
  recetas: 'id_receta, nombre_receta',
  detalle_recetas: 'id_detalle, id_receta, id_insumo',
  produccion: 'id_produccion, fecha, id_receta',
  sync_queue: '++id, action, table, timestamp, status',
  settings: 'key'
});

/**
 * Helper para inicializar datos por defecto si está vacía
 */
export async function initLocalDbWithSeedData() {
  const count = await db.insumos.count();
  if (count === 0) {
    console.log('[Dexie] Inicializando IndexedDB con datos base de demostración...');
    await db.insumos.bulkPut([
      {
        id_insumo: 'INS-001',
        nombre: 'Harina de Trigo Todo Uso',
        unidad_medida: 'gramos',
        stock_actual: 5000,
        stock_minimo: 1000,
        costo_unidad_promedio: 0.0032
      },
      {
        id_insumo: 'INS-002',
        nombre: 'Azúcar Blanca Refinada',
        unidad_medida: 'gramos',
        stock_actual: 3000,
        stock_minimo: 800,
        costo_unidad_promedio: 0.0028
      },
      {
        id_insumo: 'INS-003',
        nombre: 'Mantequilla Sin Sal',
        unidad_medida: 'gramos',
        stock_actual: 1200,
        stock_minimo: 500,
        costo_unidad_promedio: 0.0180
      },
      {
        id_insumo: 'INS-004',
        nombre: 'Huevos Frescos',
        unidad_medida: 'unidades',
        stock_actual: 48,
        stock_minimo: 12,
        costo_unidad_promedio: 0.25
      },
      {
        id_insumo: 'INS-005',
        nombre: 'Esencia de Vainilla',
        unidad_medida: 'mililitros',
        stock_actual: 250,
        stock_minimo: 50,
        costo_unidad_promedio: 0.045
      },
      {
        id_insumo: 'INS-006',
        nombre: 'Cacao en Polvo 100%',
        unidad_medida: 'gramos',
        stock_actual: 400,
        stock_minimo: 500,
        costo_unidad_promedio: 0.022
      }
    ]);

    await db.recetas.bulkPut([
      {
        id_receta: 'REC-001',
        nombre_receta: 'Pastel Clásico de Vainilla y Mantequilla',
        porciones_base: 8,
        doc_id_instrucciones: '',
        instrucciones: '1. Precalentar el horno a 180°C.\n2. Cernir la harina con una pizca de sal.\n3. Batir la mantequilla con el azúcar hasta lograr una textura cremosa y blanquecina.\n4. Agregar los huevos uno a uno mezclando suavemente.\n5. Incorporar la harina intercalando con la esencia de vainilla.\n6. Verter en molde enharinado y hornear durante 40-45 minutos.',
        url_foto_drive: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=600',
        costo_total_calculado: 6.85
      },
      {
        id_receta: 'REC-002',
        nombre_receta: 'Brownies de Cacao Intenso',
        porciones_base: 12,
        doc_id_instrucciones: '',
        instrucciones: '1. Derretir la mantequilla e incorporar el cacao en polvo hasta disolver.\n2. Batir los huevos con el azúcar en un bol aparte.\n3. Mezclar ambas preparaciones con espátula en forma envolvente.\n4. Añadir la harina suavemente sin sobrebatir.\n5. Hornear a 175°C en molde rectangular durante 25 minutos.',
        url_foto_drive: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=600',
        costo_total_calculado: 8.40
      }
    ]);

    await db.detalle_recetas.bulkPut([
      // Receta 1
      { id_detalle: 'DET-001', id_receta: 'REC-001', id_insumo: 'INS-001', cantidad_requerida: 400 },
      { id_detalle: 'DET-002', id_receta: 'REC-001', id_insumo: 'INS-002', cantidad_requerida: 300 },
      { id_detalle: 'DET-003', id_receta: 'REC-001', id_insumo: 'INS-003', cantidad_requerida: 250 },
      { id_detalle: 'DET-004', id_receta: 'REC-001', id_insumo: 'INS-004', cantidad_requerida: 4 },
      { id_detalle: 'DET-005', id_receta: 'REC-001', id_insumo: 'INS-005', cantidad_requerida: 15 },
      // Receta 2
      { id_detalle: 'DET-006', id_receta: 'REC-002', id_insumo: 'INS-001', cantidad_requerida: 200 },
      { id_detalle: 'DET-007', id_receta: 'REC-002', id_insumo: 'INS-002', cantidad_requerida: 350 },
      { id_detalle: 'DET-008', id_receta: 'REC-002', id_insumo: 'INS-003', cantidad_requerida: 200 },
      { id_detalle: 'DET-009', id_receta: 'REC-002', id_insumo: 'INS-004', cantidad_requerida: 3 },
      { id_detalle: 'DET-010', id_receta: 'REC-002', id_insumo: 'INS-006', cantidad_requerida: 120 }
    ]);

    await db.compras.bulkPut([
      {
        id_compra: 'CMP-001',
        fecha: new Date(Date.now() - 86400000 * 3).toISOString(),
        id_insumo: 'INS-001',
        cantidad_comprada: 5000,
        precio_total: 16.00,
        costo_unitario: 0.0032,
        proveedor: 'Distribuidora San Juan de la Sierra',
        registrado_por: 'reposteria@demo.com'
      },
      {
        id_compra: 'CMP-002',
        fecha: new Date(Date.now() - 86400000 * 2).toISOString(),
        id_insumo: 'INS-003',
        cantidad_comprada: 1000,
        precio_total: 18.00,
        costo_unitario: 0.0180,
        proveedor: 'Lácteos El Paisa Agropecuaria',
        registrado_por: 'reposteria@demo.com'
      }
    ]);

    await db.settings.put({ key: 'ganancias_acumuladas', value: 150000 });
  }
}
