import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/dbLocal';
import { syncManager } from '../utils/syncManager';
import { validarStockParaPreparacion, calcularCostoReceta, formatCurrency } from '../utils/calculations';
import { googleAuthService } from '../services/googleAuth';
import GlassCard from '../components/GlassCard';
import { ChefHat, AlertTriangle, CheckCircle2, Play, DollarSign, TrendingUp, Percent, PieChart } from 'lucide-react';

export default function Preparacion() {
  const recetas = useLiveQuery(() => db.recetas.toArray(), [], []);
  const insumos = useLiveQuery(() => db.insumos.toArray(), [], []);
  const todosDetalles = useLiveQuery(() => db.detalle_recetas.toArray(), [], []);
  const historialProduccion = useLiveQuery(() => db.produccion.orderBy('fecha').reverse().toArray(), [], []);

  // Consultar Ganancias Acumuladas
  const gananciasSetting = useLiveQuery(() => db.settings.get('ganancias_acumuladas'), []);
  const gananciasAcumuladasActual = gananciasSetting ? Number(gananciasSetting.value) || 0 : 0;

  const [selectedRecetaId, setSelectedRecetaId] = useState('');
  const [porcionesObjetivo, setPorcionesObjetivo] = useState(8);
  const [precioVentaTotal, setPrecioVentaTotal] = useState('');
  const [acreditarAGanancias, setAcreditarAGanancias] = useState(true);
  const [mensajeExito, setMensajeExito] = useState('');

  const selectedReceta = recetas ? recetas.find(r => r.id_receta === selectedRecetaId) : null;
  const detallesReceta = selectedReceta
    ? todosDetalles?.filter(d => d.id_receta === selectedReceta.id_receta) || []
    : [];

  // Validación de Stock en Tiempo Real
  const validacionStock = selectedReceta && insumos
    ? validarStockParaPreparacion(detallesReceta, insumos, selectedReceta.porciones_base, porcionesObjetivo)
    : { posible: true, faltantes: [] };

  // Cálculo de Costos e Inversión
  const factorEscala = selectedReceta ? Number(porcionesObjetivo) / Number(selectedReceta.porciones_base) : 1;
  const costoInsumosLote = selectedReceta && insumos
    ? detallesReceta.reduce((acc, det) => {
        const insumo = insumos.find(i => i.id_insumo === det.id_insumo);
        const cant = Number(det.cantidad_requerida) * factorEscala;
        return acc + (cant * (Number(insumo?.costo_unidad_promedio) || 0));
      }, 0)
    : 0;

  // Métricas Financieras Simuladas
  const ventaTotal = Number(precioVentaTotal) || 0;
  const gananciaNeta = ventaTotal - costoInsumosLote;
  const margenPorcentaje = ventaTotal > 0 ? (gananciaNeta / ventaTotal) * 100 : 0;
  const roiPorcentaje = costoInsumosLote > 0 ? (ventaTotal / costoInsumosLote) * 100 : 0;

  const handleEjecutarPreparacion = async (e) => {
    e.preventDefault();
    if (!selectedReceta) {
      alert('Seleccione una receta');
      return;
    }
    if (!validacionStock.posible) {
      alert('No hay suficiente stock en inventario para preparar este lote.');
      return;
    }

    const factor = Number(porcionesObjetivo) / Number(selectedReceta.porciones_base);
    const user = googleAuthService.getUser();
    let costoTotalLote = 0;

    // 1. Descontar stock de cada insumo consumido
    for (const det of detallesReceta) {
      const insumo = insumos.find(i => i.id_insumo === det.id_insumo);
      if (insumo) {
        const cantidadConsumida = Number(det.cantidad_requerida) * factor;
        const nuevoStock = Math.max(0, Number(insumo.stock_actual) - cantidadConsumida);
        costoTotalLote += cantidadConsumida * Number(insumo.costo_unidad_promedio);

        const insumoActualizado = {
          ...insumo,
          stock_actual: Math.round(nuevoStock * 100) / 100
        };

        await syncManager.enqueueMutation('UPDATE', 'insumos', insumoActualizado);
      }
    }

    // 2. Registrar en la tabla Produccion
    const produccionPayload = {
      id_produccion: `PRD-${String(Date.now()).slice(-5)}`,
      fecha: new Date().toISOString(),
      id_receta: selectedReceta.id_receta,
      porciones_producidas: Number(porcionesObjetivo),
      costo_lote: Math.round(costoTotalLote * 100) / 100,
      registrado_por: user?.email || 'usuario_local'
    };

    await syncManager.enqueueMutation('CREATE', 'produccion', produccionPayload);

    // 3. Acreditar a Ganancias Acumuladas si el checkbox está activo y la ganancia es positiva
    if (acreditarAGanancias && gananciaNeta > 0) {
      const nuevoSaldo = gananciasAcumuladasActual + gananciaNeta;
      await db.settings.put({ key: 'ganancias_acumuladas', value: Math.round(nuevoSaldo * 100) / 100 });
    }

    setMensajeExito(`¡Lote de ${selectedReceta.nombre_receta} (${porcionesObjetivo} porciones) producido con éxito! Inventario descontado ${acreditarAGanancias && gananciaNeta > 0 ? `y +${formatCurrency(gananciaNeta)} acreditados a Ganancias.` : '.'}`);
    setSelectedRecetaId('');
    setPrecioVentaTotal('');
    setTimeout(() => setMensajeExito(''), 6000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-stone-800 tracking-tight flex items-center gap-2">
          <ChefHat className="w-6 h-6 text-amber-700" />
          Nueva Preparación & Simulador Financiero
        </h2>
        <p className="text-sm text-stone-600">
          Calcule costos de insumos, simule ganancia neta, retorno de inversión y descuente el inventario
        </p>
      </div>

      {mensajeExito && (
        <div className="p-4 rounded-2xl badge-success flex items-center gap-3 animate-in fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-sm font-semibold text-emerald-900">{mensajeExito}</span>
        </div>
      )}

      {/* Formulario Principal con Simulador Financiero */}
      <GlassCard>
        <form onSubmit={handleEjecutarPreparacion} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Seleccionar Receta a Elaborar</label>
              <select
                required
                value={selectedRecetaId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedRecetaId(id);
                  const rec = recetas?.find(r => r.id_receta === id);
                  if (rec) {
                    setPorcionesObjetivo(rec.porciones_base);
                    setPrecioVentaTotal((rec.costo_total_calculado * 2).toFixed(2)); // Estimado inicial 2x costo
                  }
                }}
                className="w-full glass-input px-3.5 py-2.5 rounded-xl text-sm font-semibold text-stone-800"
              >
                <option value="">-- Elija una receta --</option>
                {recetas?.map(r => (
                  <option key={r.id_receta} value={r.id_receta}>{r.nombre_receta} (Base: {r.porciones_base} porciones)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Porciones a Elaborar en este Lote</label>
              <input
                type="number"
                min="1"
                required
                value={porcionesObjetivo}
                onChange={(e) => setPorcionesObjetivo(Math.max(1, Number(e.target.value)))}
                className="w-full glass-input px-3.5 py-2.5 rounded-xl text-sm font-bold text-amber-900"
              />
            </div>
          </div>

          {/* SIMULADOR FINANCIERO DE GANANCIAS Y ROI */}
          {selectedReceta && (
            <div className="glass-panel p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-emerald-500/10 border-amber-500/30 space-y-4">
              <h4 className="font-bold text-stone-800 text-sm flex items-center gap-2 border-b border-stone-200/60 pb-2">
                <TrendingUp className="w-4 h-4 text-emerald-700" />
                Simulador de Ventas, Ganancia & Retorno de Inversión (ROI)
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Precio de Venta Cobrado por el Lote ($)
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="Ej. 25.00"
                      value={precioVentaTotal}
                      onChange={(e) => setPrecioVentaTotal(e.target.value)}
                      className="w-full glass-input pl-9 pr-3.5 py-2 rounded-xl text-sm font-bold text-stone-900"
                    />
                  </div>
                  {ventaTotal > 0 && (
                    <span className="text-[11px] text-stone-500 mt-1 block">
                      = {formatCurrency(ventaTotal / porcionesObjetivo)} / porción
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="glass-panel p-2.5 rounded-xl bg-white/40">
                    <span className="text-[10px] text-stone-500 font-semibold block uppercase">Costo Insumos</span>
                    <span className="text-sm font-mono font-bold text-stone-800">{formatCurrency(costoInsumosLote)}</span>
                  </div>

                  <div className="glass-panel p-2.5 rounded-xl bg-emerald-500/20 text-emerald-900 border-emerald-500/30">
                    <span className="text-[10px] font-semibold block uppercase">Ganancia Neta</span>
                    <span className="text-sm font-mono font-bold">{formatCurrency(gananciaNeta)}</span>
                  </div>

                  <div className="glass-panel p-2.5 rounded-xl bg-blue-500/20 text-blue-900 border-blue-500/30">
                    <span className="text-[10px] font-semibold block uppercase">ROI (%)</span>
                    <span className="text-sm font-mono font-bold">{roiPorcentaje.toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              {ventaTotal > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-stone-200/50">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-stone-800">
                    <input
                      type="checkbox"
                      checked={acreditarAGanancias}
                      onChange={(e) => setAcreditarAGanancias(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-stone-300"
                    />
                    <span>Acreditar {formatCurrency(gananciaNeta)} a Ganancias Acumuladas en Dashboard</span>
                  </label>

                  <span className="text-xs text-stone-600 font-medium">
                    Margen de ganancia: <span className="font-bold text-emerald-800">{margenPorcentaje.toFixed(1)}%</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Panel de Validación de Inventario */}
          {selectedReceta && (
            <div className="space-y-3 pt-2">
              <h4 className="font-bold text-sm text-stone-800 flex items-center justify-between">
                <span>Verificación de Insumos para {porcionesObjetivo} porciones</span>
                <span className="text-xs text-stone-500 font-normal">
                  Factor de escala: {factorEscala.toFixed(2)}x
                </span>
              </h4>

              {!validacionStock.posible && (
                <div className="p-4 rounded-2xl badge-danger space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-red-800">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <span>Inventario Insuficiente para la Preparación:</span>
                  </div>
                  <ul className="list-disc list-inside text-xs text-red-700 space-y-1">
                    {validacionStock.faltantes.map(f => (
                      <li key={f.id_insumo}>
                        <span className="font-semibold">{f.nombre}:</span> Requiere {f.requerido} {f.unidad}, pero solo hay {f.disponible} {f.unidad} disponibles.
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Lista de desglose de insumos a descontar */}
              <div className="glass-panel p-3 rounded-xl divide-y divide-stone-200/50">
                {detallesReceta.map(det => {
                  const insumo = insumos?.find(i => i.id_insumo === det.id_insumo);
                  const requerido = (Number(det.cantidad_requerida) || 0) * factorEscala;
                  const disponible = Number(insumo?.stock_actual) || 0;
                  const suficiente = disponible >= requerido;

                  return (
                    <div key={det.id_detalle} className="py-2 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-stone-800">{insumo?.nombre || det.id_insumo}</span>
                        <span className="text-[11px] text-stone-500 block">Stock disponible: {disponible} {insumo?.unidad_medida}</span>
                      </div>
                      <div className="text-right">
                        <span className={`font-mono font-bold px-2 py-0.5 rounded-md ${suficiente ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                          Consumirá {Math.round(requerido * 100) / 100} {insumo?.unidad_medida}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={!selectedReceta || !validacionStock.posible}
              className="glass-btn-primary px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Confirmar y Descontar Inventario</span>
            </button>
          </div>
        </form>
      </GlassCard>

      {/* Historial de Lotes Producidos */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-white/40 font-bold text-stone-800">
          Historial de Lotes Producidos
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-amber-900/10 text-stone-700 font-bold uppercase text-[11px] tracking-wider border-b border-white/40">
              <tr>
                <th className="p-4">Código Lote</th>
                <th className="p-4">Fecha</th>
                <th className="p-4">Receta</th>
                <th className="p-4">Porciones</th>
                <th className="p-4">Costo Total Lote</th>
                <th className="p-4">Registrado Por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/30">
              {historialProduccion && historialProduccion.length > 0 ? (
                historialProduccion.map((p) => {
                  const recObj = recetas?.find(r => r.id_receta === p.id_receta);
                  return (
                    <tr key={p.id_produccion} className="hover:bg-white/30 transition-colors">
                      <td className="p-4 font-mono text-xs text-stone-500">{p.id_produccion}</td>
                      <td className="p-4 text-xs text-stone-600">
                        {new Date(p.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-4 font-semibold text-stone-800">{recObj ? recObj.nombre_receta : p.id_receta}</td>
                      <td className="p-4 text-stone-700 font-medium">{p.porciones_producidas} porciones</td>
                      <td className="p-4 font-mono text-amber-900 font-bold">{formatCurrency(p.costo_lote)}</td>
                      <td className="p-4 text-xs text-stone-500">{p.registrado_por}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-stone-500 text-sm">
                    No se han registrado lotes de producción.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
