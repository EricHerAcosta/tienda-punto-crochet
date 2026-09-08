import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initLocalDbWithSeedData } from '../services/dbLocal';
import { syncManager } from '../utils/syncManager';
import { calcularCostoPromedioPonderado, validarStockParaPreparacion, formatCurrency } from '../utils/calculations';
import GlassCard from '../components/GlassCard';
import { AlertTriangle, Package, ChefHat, ShoppingBag, ArrowUpRight, Zap, RefreshCw, CheckCircle2, DollarSign, Edit2, Save, X, TrendingUp } from 'lucide-react';

export default function Dashboard({ onViewChange }) {
  const insumos = useLiveQuery(() => db.insumos.toArray(), [], []);
  const recetas = useLiveQuery(() => db.recetas.toArray(), [], []);
  const compras = useLiveQuery(() => db.compras.orderBy('fecha').reverse().limit(5).toArray(), [], []);
  const producciones = useLiveQuery(() => db.produccion.orderBy('fecha').reverse().limit(5).toArray(), [], []);
  const todosDetalles = useLiveQuery(() => db.detalle_recetas.toArray(), [], []);

  // Consultar Ganancias Acumuladas
  const gananciasSetting = useLiveQuery(() => db.settings.get('ganancias_acumuladas'), []);
  const gananciasAcumuladas = gananciasSetting ? Number(gananciasSetting.value) || 0 : 0;

  const [toastMessage, setToastMessage] = useState('');
  const [showEditGananciasModal, setShowEditGananciasModal] = useState(false);
  const [nuevaGanancia, setNuevaGanancia] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const handleSaveGanancias = async (e) => {
    e.preventDefault();
    const val = Number(nuevaGanancia);
    if (isNaN(val)) return;

    await db.settings.put({ key: 'ganancias_acumuladas', value: val });
    setShowEditGananciasModal(false);
    showToast('💰 Saldo de Ganancias Acumuladas actualizado correctamente.');
  };

  // Alertas de Stock Crítico
  const insumosCriticos = insumos ? insumos.filter(i => Number(i.stock_actual) <= Number(i.stock_minimo)) : [];

  // --- ACCIONES DE PRUEBA RÁPIDA DE 1 CLIC ---
  const handleSimularCompraRapida = async () => {
    if (!insumos || insumos.length === 0) return;
    const harina = insumos.find(i => i.id_insumo === 'INS-001') || insumos[0];

    const cant = 2000;
    const precio = 8.00;
    const nuevoCostoProm = calcularCostoPromedioPonderado(harina.stock_actual, harina.costo_unidad_promedio, cant, precio);

    const compraPayload = {
      id_compra: `CMP-${String(Date.now()).slice(-5)}`,
      fecha: new Date().toISOString(),
      id_insumo: harina.id_insumo,
      cantidad_comprada: cant,
      precio_total: precio,
      costo_unitario: precio / cant,
      proveedor: 'Distribuidora San Juan de la Sierra Agroindustrial',
      registrado_por: 'prueba_rapida@demo.com'
    };

    const harinaActualizada = {
      ...harina,
      stock_actual: Number(harina.stock_actual) + cant,
      costo_unidad_promedio: nuevoCostoProm
    };

    await syncManager.enqueueMutation('CREATE', 'compras', compraPayload);
    await syncManager.enqueueMutation('UPDATE', 'insumos', harinaActualizada);

    showToast(`⚡ ¡Compra simulada! Se agregaron 2.000 ${harina.unidad_medida} de ${harina.nombre}.`);
  };

  const handleSimularPreparacionRapida = async () => {
    if (!recetas || recetas.length === 0 || !insumos) return;
    const receta = recetas[0];
    const detalles = todosDetalles?.filter(d => d.id_receta === receta.id_receta) || [];

    const validacion = validarStockParaPreparacion(detalles, insumos, receta.porciones_base, receta.porciones_base);
    if (!validacion.posible) {
      alert(`No hay stock suficiente para preparar 1 lote de ${receta.nombre_receta}. Reabastece insumos primero.`);
      return;
    }

    let costoTotalLote = 0;
    for (const det of detalles) {
      const insumo = insumos.find(i => i.id_insumo === det.id_insumo);
      if (insumo) {
        const cantConsumida = Number(det.cantidad_requerida);
        const nuevoStock = Math.max(0, Number(insumo.stock_actual) - cantConsumida);
        costoTotalLote += cantConsumida * Number(insumo.costo_unidad_promedio);

        await syncManager.enqueueMutation('UPDATE', 'insumos', {
          ...insumo,
          stock_actual: Math.round(nuevoStock * 100) / 100
        });
      }
    }

    const produccionPayload = {
      id_produccion: `PRD-${String(Date.now()).slice(-5)}`,
      fecha: new Date().toISOString(),
      id_receta: receta.id_receta,
      porciones_producidas: receta.porciones_base,
      costo_lote: Math.round(costoTotalLote * 100) / 100,
      registrado_por: 'prueba_rapida@demo.com'
    };

    await syncManager.enqueueMutation('CREATE', 'produccion', produccionPayload);

    // Sumar ganancia simulada de $15.00 al saldo acumulado
    const actual = gananciasAcumuladas;
    await db.settings.put({ key: 'ganancias_acumuladas', value: actual + 15.00 });

    showToast(`⚡ ¡Lote de ${receta.nombre_receta} preparado! Stock descontado y +$15.00 sumados a Ganancias.`);
  };

  const handleReiniciarDatos = async () => {
    if (confirm('¿Deseas reiniciar los datos locales a su estado inicial de prueba?')) {
      await db.insumos.clear();
      await db.recetas.clear();
      await db.detalle_recetas.clear();
      await db.compras.clear();
      await db.produccion.clear();
      await db.sync_queue.clear();
      await initLocalDbWithSeedData();
      showToast('🔄 Base de datos reiniciada con éxito.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-stone-800 tracking-tight">
            Panel de Control Operativo
          </h2>
          <p className="text-sm text-stone-600">
            Resumen de inventario, recetas, finanzas y producción en tiempo real
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onViewChange('preparacion')}
            className="glass-btn-primary px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"
          >
            <ChefHat className="w-4 h-4" />
            <span>Nueva Preparación</span>
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="p-3.5 rounded-2xl badge-success flex items-center gap-2 animate-in fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold text-emerald-900">{toastMessage}</span>
        </div>
      )}

      {/* Tarjeta de Ganancias Acumuladas & Widget de Pruebas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Panel de Ganancias Acumuladas */}
        <GlassCard className="bg-gradient-to-br from-emerald-500/20 via-emerald-400/10 to-teal-500/10 border-emerald-500/30 p-5 md:col-span-1 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-700" />
              Ganancias Acumuladas
            </span>
            <button
              onClick={() => {
                setNuevaGanancia(gananciasAcumuladas.toString());
                setShowEditGananciasModal(true);
              }}
              className="p-1.5 text-emerald-800 hover:bg-emerald-200/50 rounded-lg transition-colors"
              title="Editar valor manualmente"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>

          <div className="my-3">
            <span className="text-3xl font-black font-mono text-emerald-950 tracking-tight block">
              {formatCurrency(gananciasAcumuladas)}
            </span>
            <span className="text-[11px] text-emerald-800 font-medium">
              Acumulado total neto ingresado o generado
            </span>
          </div>

          <button
            onClick={() => onViewChange('preparacion')}
            className="w-full text-center py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1"
          >
            <span>Simular Ventas en Preparación</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </GlassCard>

        {/* Panel de Accesos de Pruebas Rápidas */}
        <GlassCard className="bg-amber-500/10 border-amber-500/30 p-4 md:col-span-2 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-700 fill-amber-500" />
                Panel de Pruebas Rápidas (1 Clic)
              </h3>
              <p className="text-xs text-stone-600">Simulación inmediata de transacciones y restablecimiento:</p>
            </div>
            <button
              onClick={handleReiniciarDatos}
              className="glass-btn-secondary px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5 text-stone-600" />
              <span>Restablecer Datos Demo</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleSimularCompraRapida}
              className="glass-panel p-3 rounded-xl flex items-center gap-3 text-left hover:bg-white/60 transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-800 flex items-center justify-center font-bold text-sm shrink-0">
                +
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-bold text-xs text-stone-800 block group-hover:text-emerald-900 truncate">
                  1. Simular Compra Insumo
                </span>
                <span className="text-[11px] text-stone-500 block truncate">Agrega 2.000g y recalcula costo</span>
              </div>
            </button>

            <button
              onClick={handleSimularPreparacionRapida}
              className="glass-panel p-3 rounded-xl flex items-center gap-3 text-left hover:bg-white/60 transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-800 flex items-center justify-center font-bold text-sm shrink-0">
                ⚡
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-bold text-xs text-stone-800 block group-hover:text-amber-900 truncate">
                  2. Simular Preparar Lote
                </span>
                <span className="text-[11px] text-stone-500 block truncate">Descuenta stock y acredita +$15.00</span>
              </div>
            </button>
          </div>
        </GlassCard>
      </div>

      {/* Alerta de Stock Crítico */}
      {insumosCriticos.length > 0 && (
        <div className="p-4 rounded-2xl badge-danger flex items-start gap-3 backdrop-blur-md shadow-sm">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-sm text-red-800">
              ¡Atención! {insumosCriticos.length} insumo(s) en nivel crítico o agotado:
            </h4>
            <p className="text-xs text-red-700 mt-1">
              {insumosCriticos.map(i => `${i.nombre} (${i.stock_actual} ${i.unidad_medida})`).join(', ')}
            </p>
          </div>
          <button
            onClick={() => onViewChange('compras')}
            className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors shrink-0"
          >
            Reabastecer
          </button>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard interactive onClick={() => onViewChange('inventario')}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Insumos Registrados</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-stone-800">{insumos ? insumos.length : 0}</span>
            <span className="text-xs text-stone-500">Categorizados</span>
          </div>
        </GlassCard>

        <GlassCard interactive onClick={() => onViewChange('recetario')}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Recetario Activo</span>
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-700 flex items-center justify-center">
              <ChefHat className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-stone-800">{recetas ? recetas.length : 0}</span>
            <span className="text-xs text-stone-500">Recetas costeadas</span>
          </div>
        </GlassCard>

        <GlassCard interactive onClick={() => onViewChange('compras')}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Compras Recientes</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-700 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-stone-800">{compras ? compras.length : 0}</span>
            <span className="text-xs text-stone-500">Registradas</span>
          </div>
        </GlassCard>

        <GlassCard interactive onClick={() => onViewChange('preparacion')}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Producción Registrada</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-700 flex items-center justify-center">
              <ChefHat className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-stone-800">{producciones ? producciones.length : 0}</span>
            <span className="text-xs text-stone-500">Lotes preparados</span>
          </div>
        </GlassCard>
      </div>

      {/* Recetas Destacadas e Insumos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recetario Rápido */}
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-stone-800 text-base flex items-center gap-2">
              <ChefHat className="w-4 h-4 text-amber-700" />
              Recetas y Costos Base
            </h3>
            <button
              onClick={() => onViewChange('recetario')}
              className="text-xs font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-1"
            >
              Ver todas <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {recetas && recetas.length > 0 ? (
              recetas.slice(0, 4).map((receta) => (
                <div key={receta.id_receta} className="glass-panel p-3 rounded-xl flex items-center gap-3">
                  <img
                    src={receta.url_foto_drive || 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=150'}
                    alt={receta.nombre_receta}
                    className="w-12 h-12 rounded-lg object-cover border border-white/60 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm text-stone-800 truncate">{receta.nombre_receta}</h4>
                    <p className="text-xs text-stone-500">Rinde: {receta.porciones_base} porciones</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-amber-900 block">
                      {formatCurrency(receta.costo_total_calculado)}
                    </span>
                    <span className="text-[10px] text-stone-500">
                      {formatCurrency(receta.costo_total_calculado / (receta.porciones_base || 1))}/porción
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-stone-500 text-center py-4">No hay recetas registradas.</p>
            )}
          </div>
        </GlassCard>

        {/* Insumos con Bajo Stock */}
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-stone-800 text-base flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-700" />
              Estado de Inventario
            </h3>
            <button
              onClick={() => onViewChange('inventario')}
              className="text-xs font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-1"
            >
              Gestionar <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {insumos && insumos.length > 0 ? (
              insumos.slice(0, 5).map((insumo) => {
                const esCritico = Number(insumo.stock_actual) <= Number(insumo.stock_minimo);
                return (
                  <div key={insumo.id_insumo} className="flex items-center justify-between p-2.5 rounded-xl bg-white/30 backdrop-blur-sm border border-white/40">
                    <div>
                      <span className="font-medium text-xs text-stone-800 block">{insumo.nombre}</span>
                      <span className="text-[11px] text-stone-500">Costo prom: {formatCurrency(insumo.costo_unidad_promedio)} / {insumo.unidad_medida}</span>
                    </div>
                    <div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${esCritico ? 'badge-danger' : 'badge-success'}`}>
                        {insumo.stock_actual} {insumo.unidad_medida}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-stone-500 text-center py-4">No hay insumos registrados.</p>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Modal Editar Ganancias Acumuladas */}
      {showEditGananciasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200/50 mb-4">
              <h3 className="font-bold text-base text-stone-800 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                Editar Ganancias Acumuladas
              </h3>
              <button
                onClick={() => setShowEditGananciasModal(false)}
                className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGanancias} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Monto de Ganancias ($)</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={nuevaGanancia}
                  onChange={(e) => setNuevaGanancia(e.target.value)}
                  className="w-full glass-input px-3.5 py-2.5 rounded-xl text-lg font-mono font-bold text-emerald-950"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-stone-200/50">
                <button
                  type="button"
                  onClick={() => setShowEditGananciasModal(false)}
                  className="glass-btn-secondary px-4 py-2 rounded-xl text-xs font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="glass-btn-primary bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Saldo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
