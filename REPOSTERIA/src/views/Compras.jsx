import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/dbLocal';
import { syncManager } from '../utils/syncManager';
import { calcularCostoPromedioPonderado, formatCurrency } from '../utils/calculations';
import { googleAuthService } from '../services/googleAuth';
import GlassCard from '../components/GlassCard';
import { ShoppingBag, Plus, Store, Edit2, Trash2, Save, X } from 'lucide-react';

export default function Compras() {
  const insumos = useLiveQuery(() => db.insumos.toArray(), [], []);
  const compras = useLiveQuery(() => db.compras.orderBy('fecha').reverse().toArray(), [], []);

  const [showModal, setShowModal] = useState(false);
  const [editingCompra, setEditingCompra] = useState(null);

  const [selectedInsumoId, setSelectedInsumoId] = useState('');
  const [cantidadComprada, setCantidadComprada] = useState('');
  const [precioTotal, setPrecioTotal] = useState('');
  const [proveedor, setProveedor] = useState('');

  const selectedInsumo = insumos ? insumos.find(i => i.id_insumo === selectedInsumoId) : null;
  const costoUnitarioCalculado = Number(cantidadComprada) > 0 && Number(precioTotal) > 0
    ? (Number(precioTotal) / Number(cantidadComprada)).toFixed(5)
    : 0;

  const handleOpenModal = (compra = null) => {
    if (compra) {
      setEditingCompra(compra);
      setSelectedInsumoId(compra.id_insumo);
      setCantidadComprada(compra.cantidad_comprada.toString());
      setPrecioTotal(compra.precio_total.toString());
      setProveedor(compra.proveedor);
    } else {
      setEditingCompra(null);
      setSelectedInsumoId('');
      setCantidadComprada('');
      setPrecioTotal('');
      setProveedor('');
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCompra(null);
  };

  const handleSubmitCompra = async (e) => {
    e.preventDefault();
    if (!selectedInsumo) {
      alert('Seleccione un insumo');
      return;
    }

    const cant = Number(cantidadComprada);
    const precio = Number(precioTotal);
    if (cant <= 0 || precio <= 0) {
      alert('Ingrese una cantidad y un precio total válidos');
      return;
    }

    const user = googleAuthService.getUser();

    if (editingCompra) {
      // Edición de compra existente
      const deltaCant = cant - Number(editingCompra.cantidad_comprada);
      const nuevoStock = Math.max(0, Number(selectedInsumo.stock_actual) + deltaCant);

      const nuevoCostoProm = calcularCostoPromedioPonderado(
        nuevoStock - cant,
        selectedInsumo.costo_unidad_promedio,
        cant,
        precio
      );

      const compraPayload = {
        ...editingCompra,
        id_insumo: selectedInsumo.id_insumo,
        cantidad_comprada: cant,
        precio_total: precio,
        costo_unitario: Number(costoUnitarioCalculado),
        proveedor: proveedor.trim() || 'Proveedor General'
      };

      const insumoActualizado = {
        ...selectedInsumo,
        stock_actual: nuevoStock,
        costo_unidad_promedio: nuevoCostoProm
      };

      await syncManager.enqueueMutation('UPDATE', 'compras', compraPayload);
      await syncManager.enqueueMutation('UPDATE', 'insumos', insumoActualizado);
    } else {
      // Nueva compra
      const idCompra = `CMP-${String(Date.now()).slice(-5)}`;

      const compraPayload = {
        id_compra: idCompra,
        fecha: new Date().toISOString(),
        id_insumo: selectedInsumo.id_insumo,
        cantidad_comprada: cant,
        precio_total: precio,
        costo_unitario: Number(costoUnitarioCalculado),
        proveedor: proveedor.trim() || 'Proveedor General',
        registrado_por: user?.email || 'usuario_local'
      };

      const nuevoCostoPromedio = calcularCostoPromedioPonderado(
        selectedInsumo.stock_actual,
        selectedInsumo.costo_unidad_promedio,
        cant,
        precio
      );

      const insumoActualizado = {
        ...selectedInsumo,
        stock_actual: Number(selectedInsumo.stock_actual) + cant,
        costo_unidad_promedio: nuevoCostoPromedio
      };

      await syncManager.enqueueMutation('CREATE', 'compras', compraPayload);
      await syncManager.enqueueMutation('UPDATE', 'insumos', insumoActualizado);
    }

    handleCloseModal();
  };

  const handleDeleteCompra = async (compra) => {
    if (confirm(`¿Deseas eliminar el registro de compra ${compra.id_compra}? Esto restará ${compra.cantidad_comprada} del inventario.`)) {
      const insumoObj = insumos?.find(i => i.id_insumo === compra.id_insumo);
      if (insumoObj) {
        const nuevoStock = Math.max(0, Number(insumoObj.stock_actual) - Number(compra.cantidad_comprada));
        await syncManager.enqueueMutation('UPDATE', 'insumos', {
          ...insumoObj,
          stock_actual: nuevoStock
        });
      }
      await syncManager.enqueueMutation('DELETE', 'compras', compra);
    }
  };

  // Comparador de proveedores (Agrupación de compras por insumo y proveedor)
  const comparadorProveedores = compras ? compras.reduce((acc, c) => {
    const key = `${c.id_insumo}_${c.proveedor}`;
    if (!acc[key]) {
      acc[key] = {
        id_insumo: c.id_insumo,
        insumoNombre: insumos?.find(i => i.id_insumo === c.id_insumo)?.nombre || c.id_insumo,
        unidad: insumos?.find(i => i.id_insumo === c.id_insumo)?.unidad_medida || '',
        proveedor: c.proveedor,
        costos: []
      };
    }
    acc[key].costos.push(Number(c.costo_unitario));
    return acc;
  }, {}) : {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-stone-800 tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-amber-700" />
            Registro de Compras & Proveedores
          </h2>
          <p className="text-sm text-stone-600">
            Entrada de stock con recálculo automático de costo promedio ponderado
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="glass-btn-primary px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Compra</span>
        </button>
      </div>

      {/* Histórico de Compras */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-white/40 font-bold text-stone-800 flex items-center justify-between">
          <span>Historial Reciente de Compras</span>
          <span className="text-xs font-normal text-stone-500">{compras ? compras.length : 0} transacciones</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-amber-900/10 text-stone-700 font-bold uppercase text-[11px] tracking-wider border-b border-white/40">
              <tr>
                <th className="p-4">Código</th>
                <th className="p-4">Fecha</th>
                <th className="p-4">Insumo</th>
                <th className="p-4">Cantidad</th>
                <th className="p-4">Precio Total</th>
                <th className="p-4">Costo Unit.</th>
                <th className="p-4">Proveedor</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/30">
              {compras && compras.length > 0 ? (
                compras.map((c) => {
                  const insumoObj = insumos?.find(i => i.id_insumo === c.id_insumo);
                  return (
                    <tr key={c.id_compra} className="hover:bg-white/30 transition-colors">
                      <td className="p-4 font-mono text-xs text-stone-500">{c.id_compra}</td>
                      <td className="p-4 text-xs text-stone-600">
                        {new Date(c.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-4 font-semibold text-stone-800">
                        {insumoObj ? insumoObj.nombre : c.id_insumo}
                      </td>
                      <td className="p-4 text-stone-700">
                        {c.cantidad_comprada} {insumoObj ? insumoObj.unidad_medida : ''}
                      </td>
                      <td className="p-4 font-mono text-emerald-800 font-semibold">
                        {formatCurrency(c.precio_total)}
                      </td>
                      <td className="p-4 font-mono text-stone-800">
                        {formatCurrency(c.costo_unitario)}
                      </td>
                      <td className="p-4">
                        <span
                          className="px-2.5 py-1 rounded-full text-xs badge-info inline-block max-w-[140px] truncate"
                          title={c.proveedor}
                        >
                          {c.proveedor}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenModal(c)}
                            className="p-1.5 rounded-lg text-amber-800 hover:bg-amber-100/50 transition-colors"
                            title="Editar compra"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCompra(c)}
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-100/50 transition-colors"
                            title="Eliminar compra"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-stone-500 text-sm">
                    No se han registrado compras.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Comparador de Proveedores */}
      <div className="space-y-3">
        <h3 className="font-bold text-stone-800 text-base flex items-center gap-2">
          <Store className="w-5 h-5 text-amber-700" />
          Comparador Histórico de Proveedores
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.values(comparadorProveedores).map((comp, idx) => {
            const promCosto = (comp.costos.reduce((a, b) => a + b, 0) / comp.costos.length).toFixed(5);
            return (
              <GlassCard key={idx} className="p-4">
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1 pr-2">
                    <h4 className="font-bold text-sm text-stone-800 truncate">{comp.insumoNombre}</h4>
                    <p className="text-xs text-stone-500 truncate" title={comp.proveedor}>
                      Proveedor: <span className="font-semibold text-stone-700">{comp.proveedor}</span>
                    </p>
                  </div>
                  <span className="badge-info text-xs px-2 py-0.5 rounded-full font-medium shrink-0">
                    {comp.costos.length} compra(s)
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-stone-200/50 flex justify-between items-baseline">
                  <span className="text-xs text-stone-500">Costo Promed. / {comp.unidad}:</span>
                  <span className="font-mono text-sm font-bold text-amber-900">{formatCurrency(promCosto)}</span>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* Modal Registrar/Editar Compra */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200/50 mb-4">
              <h3 className="font-bold text-lg text-stone-800 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-700" />
                {editingCompra ? 'Editar Registro de Compra' : 'Nueva Compra de Insumos'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCompra} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Seleccionar Insumo</label>
                <select
                  required
                  disabled={!!editingCompra}
                  value={selectedInsumoId}
                  onChange={(e) => setSelectedInsumoId(e.target.value)}
                  className="w-full glass-input px-3.5 py-2 rounded-xl text-sm disabled:opacity-75"
                >
                  <option value="">-- Elija un insumo --</option>
                  {insumos?.map(i => (
                    <option key={i.id_insumo} value={i.id_insumo}>
                      {i.nombre} (Stock actual: {i.stock_actual} {i.unidad_medida})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Cantidad Comprada ({selectedInsumo ? selectedInsumo.unidad_medida : 'unidades'})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.0001"
                    required
                    placeholder="Ej. 5000"
                    value={cantidadComprada}
                    onChange={(e) => setCantidadComprada(e.target.value)}
                    className="w-full glass-input px-3.5 py-2 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Precio Total Pagado ($)</label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    placeholder="Ej. 16.00"
                    value={precioTotal}
                    onChange={(e) => setPrecioTotal(e.target.value)}
                    className="w-full glass-input px-3.5 py-2 rounded-xl text-sm"
                  />
                </div>
              </div>

              {costoUnitarioCalculado > 0 && (
                <div className="glass-panel p-3 rounded-xl bg-amber-500/10 border-amber-500/30 text-xs flex justify-between items-center">
                  <span className="text-stone-700 font-medium">Costo unitario calculado de esta compra:</span>
                  <span className="font-mono font-bold text-amber-900">{formatCurrency(costoUnitarioCalculado)} / {selectedInsumo?.unidad_medida}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Proveedor / Vendedor</label>
                <input
                  type="text"
                  placeholder="Ej. Distribuidora San Juan"
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                  className="w-full glass-input px-3.5 py-2 rounded-xl text-sm"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-stone-200/50">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="glass-btn-secondary px-4 py-2 rounded-xl text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="glass-btn-primary px-5 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingCompra ? 'Actualizar Compra' : 'Guardar y Actualizar Stock'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
