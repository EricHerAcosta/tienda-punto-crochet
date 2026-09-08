import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/dbLocal';
import { syncManager } from '../utils/syncManager';
import GlassCard from '../components/GlassCard';
import { Package, Plus, Edit2, Trash2, Search, Save, X, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../utils/calculations';

export default function Inventario() {
  const insumos = useLiveQuery(() => db.insumos.toArray(), [], []);
  const todosDetalles = useLiveQuery(() => db.detalle_recetas.toArray(), [], []);
  const todasRecetas = useLiveQuery(() => db.recetas.toArray(), [], []);

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [formData, setFormData] = useState({
    id_insumo: '',
    nombre: '',
    unidad_medida: 'gramos',
    stock_actual: '',
    stock_minimo: '',
    costo_unidad_promedio: ''
  });

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({ ...item });
    } else {
      setEditingItem(null);
      setFormData({
        id_insumo: `INS-${String(Date.now()).slice(-4)}`,
        nombre: '',
        unidad_medida: 'gramos',
        stock_actual: '0',
        stock_minimo: '500',
        costo_unidad_promedio: '0'
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingItem(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      alert('Por favor ingrese el nombre del insumo');
      return;
    }

    const payload = {
      id_insumo: formData.id_insumo || `INS-${String(Date.now()).slice(-4)}`,
      nombre: formData.nombre.trim(),
      unidad_medida: formData.unidad_medida,
      stock_actual: Number(formData.stock_actual) || 0,
      stock_minimo: Number(formData.stock_minimo) || 0,
      costo_unidad_promedio: Number(formData.costo_unidad_promedio) || 0
    };

    const action = editingItem ? 'UPDATE' : 'CREATE';
    await syncManager.enqueueMutation(action, 'insumos', payload);
    handleCloseModal();
  };

  const handleDeleteInsumo = async (item) => {
    // Verificar si el insumo está en uso en alguna receta
    const recetasRelacionadas = todosDetalles
      ? todosDetalles.filter(d => d.id_insumo === item.id_insumo)
      : [];

    let warningMsg = `¿Estás seguro de que deseas eliminar el insumo "${item.nombre}"?`;
    if (recetasRelacionadas.length > 0) {
      const nombres = recetasRelacionadas.map(d => {
        const r = todasRecetas?.find(rec => rec.id_receta === d.id_receta);
        return r ? r.nombre_receta : d.id_receta;
      }).join(', ');

      warningMsg = `⚠️ ¡ATENCIÓN! Este insumo está siendo utilizado en ${recetasRelacionadas.length} receta(s): [${nombres}].\n\n¿Realmente deseas eliminar "${item.nombre}" de tu inventario?`;
    }

    if (confirm(warningMsg)) {
      await syncManager.enqueueMutation('DELETE', 'insumos', item);
    }
  };

  const filteredInsumos = insumos
    ? insumos.filter(i => i.nombre.toLowerCase().includes(search.toLowerCase()))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-stone-800 tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-amber-700" />
            Control de Inventario de Insumos
          </h2>
          <p className="text-sm text-stone-600">
            Administre materias primas, unidades de medida y umbrales mínimos
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="glass-btn-primary px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Insumo</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar insumo por nombre (ej. Harina, Mantequilla)..."
          className="w-full glass-input pl-10 pr-4 py-2.5 rounded-xl text-sm"
        />
      </div>

      {/* Insumos Table */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-amber-900/10 text-stone-700 font-bold uppercase text-[11px] tracking-wider border-b border-white/40">
              <tr>
                <th className="p-4">Código</th>
                <th className="p-4">Nombre del Insumo</th>
                <th className="p-4">Unidad</th>
                <th className="p-4">Stock Actual</th>
                <th className="p-4">Stock Mínimo</th>
                <th className="p-4">Costo Prom. Unit.</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/30">
              {filteredInsumos.length > 0 ? (
                filteredInsumos.map((item) => {
                  const esCritico = Number(item.stock_actual) <= Number(item.stock_minimo);
                  return (
                    <tr key={item.id_insumo} className="hover:bg-white/30 transition-colors">
                      <td className="p-4 font-mono text-xs text-stone-500">{item.id_insumo}</td>
                      <td className="p-4 font-semibold text-stone-800">{item.nombre}</td>
                      <td className="p-4 text-stone-600 capitalize">{item.unidad_medida}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${esCritico ? 'badge-danger' : 'badge-success'}`}>
                          {item.stock_actual} {item.unidad_medida}
                        </span>
                      </td>
                      <td className="p-4 text-stone-600">{item.stock_minimo} {item.unidad_medida}</td>
                      <td className="p-4 font-mono text-stone-800 font-medium">
                        {formatCurrency(item.costo_unidad_promedio)}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenModal(item)}
                            className="p-1.5 rounded-lg text-amber-800 hover:bg-amber-100/50 transition-colors"
                            title="Editar insumo"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteInsumo(item)}
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-100/50 transition-colors"
                            title="Eliminar insumo"
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
                  <td colSpan="7" className="p-8 text-center text-stone-500 text-sm">
                    No se encontraron insumos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Modal Formulario Insumo */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200/50 mb-4">
              <h3 className="font-bold text-lg text-stone-800">
                {editingItem ? 'Editar Insumo' : 'Registrar Nuevo Insumo'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Nombre del Insumo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Harina de Trigo Todo Uso"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full glass-input px-3.5 py-2 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Unidad de Medida</label>
                  <select
                    value={formData.unidad_medida}
                    onChange={(e) => setFormData({ ...formData, unidad_medida: e.target.value })}
                    className="w-full glass-input px-3 py-2 rounded-xl text-sm"
                  >
                    <option value="gramos">Gramos (g)</option>
                    <option value="mililitros">Mililitros (ml)</option>
                    <option value="unidades">Unidades (ud)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Stock Actual</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.stock_actual}
                    onChange={(e) => setFormData({ ...formData, stock_actual: e.target.value })}
                    className="w-full glass-input px-3.5 py-2 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Stock Mínimo (Alerta)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.stock_minimo}
                    onChange={(e) => setFormData({ ...formData, stock_minimo: e.target.value })}
                    className="w-full glass-input px-3.5 py-2 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Costo Unit. Promedio ($)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.costo_unidad_promedio}
                    onChange={(e) => setFormData({ ...formData, costo_unidad_promedio: e.target.value })}
                    className="w-full glass-input px-3.5 py-2 rounded-xl text-sm"
                  />
                </div>
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
                  <span>Guardar Insumo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
