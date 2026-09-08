/**
 * Utilidades de cálculo financiero y de inventario para la plataforma de Repostería
 */

/**
 * Calcula el nuevo costo promedio ponderado tras registrar una compra
 * @param {number} stockActual - Inventario actual previo a la compra
 * @param {number} costoPromedioAnt - Costo unitario promedio anterior
 * @param {number} cantidadComprada - Cantidad adquirida en la compra
 * @param {number} precioTotalCompra - Monto total pagado en la compra
 * @returns {number} Nuevo costo unitario promedio ponderado
 */
export function calcularCostoPromedioPonderado(stockActual, costoPromedioAnt, cantidadComprada, precioTotalCompra) {
  const stock = Number(stockActual) || 0;
  const costoAnt = Number(costoPromedioAnt) || 0;
  const cant = Number(cantidadComprada) || 0;
  const precio = Number(precioTotalCompra) || 0;

  const stockTotal = stock + cant;
  if (stockTotal <= 0) return 0;

  const valorAnterior = stock * costoAnt;
  const nuevoCostoPromedio = (valorAnterior + precio) / stockTotal;

  return Math.round(nuevoCostoPromedio * 100000) / 100000;
}

/**
 * Calcula el costo total de una receta en función del costo unitario actual de sus insumos
 * @param {Array<{id_insumo: string, cantidad_requerida: number}>} detalles - Insumos requeridos en la receta
 * @param {Array<Object>} insumosList - Lista de todos los insumos disponibles con sus costos actuales
 * @returns {number} Costo total de la receta
 */
export function calcularCostoReceta(detalles, insumosList) {
  if (!Array.isArray(detalles) || !Array.isArray(insumosList)) return 0;

  const mapInsumos = new Map(insumosList.map(i => [i.id_insumo, Number(i.costo_unidad_promedio) || 0]));

  let total = 0;
  for (const det of detalles) {
    const costoUnit = mapInsumos.get(det.id_insumo) || 0;
    const cant = Number(det.cantidad_requerida) || 0;
    total += cant * costoUnit;
  }

  return Math.round(total * 100) / 100;
}

/**
 * Escala las cantidades requeridas de insumos según las porciones objetivo
 * @param {number} porcionesBase - Porciones estándar que rinde la receta
 * @param {number} porcionesObjetivo - Porciones que se desean preparar
 * @param {number} cantidadBase - Cantidad requerida para las porciones base
 * @returns {number} Cantidad escalada
 */
export function escalarCantidadInsumo(porcionesBase, porcionesObjetivo, cantidadBase) {
  const base = Number(porcionesBase) || 1;
  const target = Number(porcionesObjetivo) || 1;
  const cant = Number(cantidadBase) || 0;

  const factor = target / base;
  return Math.round(cant * factor * 100) / 100;
}

/**
 * Valida si existe stock suficiente en inventario para producir un lote de receta
 * @param {Array} detallesReceta - Insumos requeridos por la receta
 * @param {Array} insumosList - Lista actual de insumos con stock_actual
 * @param {number} porcionesBase - Porciones base de la receta
 * @param {number} porcionesProducidas - Porciones que se van a producir
 * @returns {{ posible: boolean, faltantes: Array<{nombre: string, requerido: number, disponible: number, unidad: string}> }}
 */
export function validarStockParaPreparacion(detallesReceta, insumosList, porcionesBase, porcionesProducidas) {
  const mapInsumos = new Map(insumosList.map(i => [i.id_insumo, i]));
  const factor = Number(porcionesProducidas) / Number(porcionesBase);
  const faltantes = [];

  for (const det of detallesReceta) {
    const insumo = mapInsumos.get(det.id_insumo);
    const requerido = (Number(det.cantidad_requerida) || 0) * factor;
    const disponible = insumo ? Number(insumo.stock_actual) || 0 : 0;

    if (disponible < requerido) {
      faltantes.push({
        id_insumo: det.id_insumo,
        nombre: insumo ? insumo.nombre : det.id_insumo,
        requerido: Math.round(requerido * 100) / 100,
        disponible: Math.round(disponible * 100) / 100,
        unidad: insumo ? insumo.unidad_medida : ''
      });
    }
  }

  return {
    posible: faltantes.length === 0,
    faltantes
  };
}

/**
 * Formatea valores numéricos como moneda ($ USD / COP)
 */
export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 2
  }).format(num);
}
