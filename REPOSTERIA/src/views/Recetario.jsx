import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/dbLocal';
import { syncManager } from '../utils/syncManager';
import { calcularCostoReceta, escalarCantidadInsumo, formatCurrency } from '../utils/calculations';
import { docsService } from '../services/docsService';
import { googleAuthService } from '../services/googleAuth';
import GlassCard from '../components/GlassCard';
import { BookOpen, Plus, FileText, Edit2, Trash2, Save, X, ExternalLink, ChefHat } from 'lucide-react';

export default function Recetario() {
  const recetas = useLiveQuery(() => db.recetas.toArray(), [], []);
  const insumos = useLiveQuery(() => db.insumos.toArray(), [], []);
  const todosDetalles = useLiveQuery(() => db.detalle_recetas.toArray(), [], []);

  const [selectedReceta, setSelectedReceta] = useState(null);
  const [scalePortions, setScalePortions] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [editingReceta, setEditingReceta] = useState(null);

  const [nombreReceta, setNombreReceta] = useState('');
  const [porcionesBase, setPorcionesBase] = useState(8);
  const [fotoUrl, setFotoUrl] = useState('');
  const [instruccionesText, setInstruccionesText] = useState('');
  const [ingredientesSeleccionados, setIngredientesSeleccionados] = useState([]);

  // Abrir visor de receta
  const handleOpenVisor = (receta) => {
    setSelectedReceta(receta);
    setScalePortions(receta.porciones_base);
  };

  // Abrir modal de creación o edición
  const handleOpenModal = (recetaToEdit = null) => {
    if (recetaToEdit) {
      setEditingReceta(recetaToEdit);
      setNombreReceta(recetaToEdit.nombre_receta);
      setPorcionesBase(recetaToEdit.porciones_base);
      setFotoUrl(recetaToEdit.url_foto_drive || '');
      setInstruccionesText(recetaToEdit.instrucciones || '');

      const detallesActuales = todosDetalles
        ? todosDetalles.filter(d => d.id_receta === recetaToEdit.id_receta)
        : [];
      setIngredientesSeleccionados(
        detallesActuales.map(d => ({ id_insumo: d.id_insumo, cantidad_requerida: d.cantidad_requerida }))
      );
    } else {
      setEditingReceta(null);
      setNombreReceta('');
      setPorcionesBase(8);
      setFotoUrl('');
      setInstruccionesText('');
      setIngredientesSeleccionados([]);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingReceta(null);
  };

  const handleAddIngredienteRow = () => {
    setIngredientesSeleccionados([
      ...ingredientesSeleccionados,
      { id_insumo: '', cantidad_requerida: '' }
    ]);
  };

  const handleRemoveIngredienteRow = (index) => {
    setIngredientesSeleccionados(ingredientesSeleccionados.filter((_, i) => i !== index));
  };

  const handleUpdateIngredienteRow = (index, field, value) => {
    const next = [...ingredientesSeleccionados];
    next[index][field] = value;
    setIngredientesSeleccionados(next);
  };

  const handleSubmitReceta = async (e) => {
    e.preventDefault();
    if (!nombreReceta.trim()) {
      alert('Ingrese el nombre de la receta');
      return;
    }
    if (ingredientesSeleccionados.length === 0) {
      alert('Agregue al menos un ingrediente a la receta');
      return;
    }

    const idReceta = editingReceta ? editingReceta.id_receta : `REC-${String(Date.now()).slice(-4)}`;

    // Crear/actualizar Documento en Google Docs si está autenticado
    let docId = editingReceta ? editingReceta.doc_id_instrucciones : '';
    if (googleAuthService.isLoggedIn() && instruccionesText.trim()) {
      try {
        if (docId) {
          await docsService.updateDocumentContent(docId, instruccionesText);
        } else {
          docId = await docsService.createRecipeDocument(nombreReceta, instruccionesText);
        }
      } catch (err) {
        console.warn('Google Docs sync diferido o no disponible offline:', err);
      }
    }

    const detallesFormateados = ingredientesSeleccionados.map((item, idx) => ({
      id_detalle: `DET-${Date.now()}-${idx}`,
      id_receta: idReceta,
      id_insumo: item.id_insumo,
      cantidad_requerida: Number(item.cantidad_requerida) || 0
    }));

    const costoTotal = calcularCostoReceta(detallesFormateados, insumos || []);

    const recetaPayload = {
      id_receta: idReceta,
      nombre_receta: nombreReceta.trim(),
      porciones_base: Number(porcionesBase) || 1,
      doc_id_instrucciones: docId,
      instrucciones: instruccionesText.trim(),
      url_foto_drive: fotoUrl.trim() || 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600',
      costo_total_calculado: costoTotal
    };

    if (editingReceta) {
      // Eliminar detalles viejos e insertar nuevos
      const viejosDetalles = todosDetalles?.filter(d => d.id_receta === idReceta) || [];
      for (const d of viejosDetalles) {
        await db.detalle_recetas.delete(d.id_detalle);
      }
      await syncManager.enqueueMutation('UPDATE', 'recetas', recetaPayload);
      for (const det of detallesFormateados) {
        await syncManager.enqueueMutation('CREATE', 'detalle_recetas', det);
      }
    } else {
      await syncManager.enqueueMutation('CREATE', 'recetas', recetaPayload);
      for (const det of detallesFormateados) {
        await syncManager.enqueueMutation('CREATE', 'detalle_recetas', det);
      }
    }

    handleCloseModal();
    if (selectedReceta && selectedReceta.id_receta === idReceta) {
      setSelectedReceta(recetaPayload);
    }
  };

  const handleDeleteReceta = async (receta) => {
    if (confirm(`¿Deseas eliminar la receta "${receta.nombre_receta}"? Esta acción no se puede deshacer.`)) {
      const detallesARemover = todosDetalles?.filter(d => d.id_receta === receta.id_receta) || [];
      for (const det of detallesARemover) {
        await syncManager.enqueueMutation('DELETE', 'detalle_recetas', det);
      }
      await syncManager.enqueueMutation('DELETE', 'recetas', receta);
      setSelectedReceta(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-stone-800 tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-amber-700" />
            Recetario Interactivo & Costeo
          </h2>
          <p className="text-sm text-stone-600">
            Fichas técnicas con procedimientos detallados, imágenes y cálculo dinámico de costos
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="glass-btn-primary px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Receta</span>
        </button>
      </div>

      {/* Catálogo de Recetas Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {recetas && recetas.length > 0 ? (
          recetas.map((receta) => {
            const detallesReceta = todosDetalles
              ? todosDetalles.filter(d => d.id_receta === receta.id_receta)
              : [];
            const costoRealTime = calcularCostoReceta(detallesReceta, insumos || []);
            const costoPorcion = receta.porciones_base > 0 ? costoRealTime / receta.porciones_base : 0;

            return (
              <GlassCard key={receta.id_receta} className="p-0 overflow-hidden group flex flex-col justify-between">
                <div>
                  <div
                    onClick={() => handleOpenVisor(receta)}
                    className="relative h-44 w-full overflow-hidden cursor-pointer"
                  >
                    <img
                      src={receta.url_foto_drive || 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600'}
                      alt={receta.nombre_receta}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-900/80 via-transparent to-transparent"></div>
                    <span className="absolute top-3 right-3 glass-panel px-2.5 py-1 rounded-full text-xs font-bold text-stone-800 backdrop-blur-md">
                      {receta.porciones_base} porciones
                    </span>
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <h3 className="font-bold text-base leading-tight drop-shadow-sm">{receta.nombre_receta}</h3>
                    </div>
                  </div>

                  <div className="p-4 space-y-2 cursor-pointer" onClick={() => handleOpenVisor(receta)}>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500">Costo Insumos:</span>
                      <span className="font-mono font-bold text-amber-900 text-sm">{formatCurrency(costoRealTime)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pt-1 border-t border-stone-200/50">
                      <span className="text-stone-500">Costo / Porción:</span>
                      <span className="font-mono font-semibold text-emerald-800">{formatCurrency(costoPorcion)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white/40 border-t border-white/40 flex justify-end gap-2">
                  <button
                    onClick={() => handleOpenModal(receta)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-amber-800 hover:bg-amber-100/60 transition-colors flex items-center gap-1"
                    title="Editar receta"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button
                    onClick={() => handleDeleteReceta(receta)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-red-600 hover:bg-red-100/60 transition-colors flex items-center gap-1"
                    title="Eliminar receta"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                  </button>
                </div>
              </GlassCard>
            );
          })
        ) : (
          <p className="col-span-full text-center text-stone-500 py-12 glass-panel rounded-2xl">
            No hay recetas creadas en el catálogo. ¡Crea tu primera receta!
          </p>
        )}
      </div>

      {/* Visor & Escalador de Receta Modal con Lectura Interna de Procedimiento */}
      {selectedReceta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-md">
          <div className="glass-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            {/* Header Visor con Botón de Salida Proeminente */}
            <div className="flex items-center justify-between pb-4 border-b border-stone-200/50 mb-4 sticky top-0 bg-white/60 backdrop-blur-md z-10 p-2 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center font-bold">
                  <ChefHat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-stone-800 leading-tight">{selectedReceta.nombre_receta}</h3>
                  <span className="text-xs text-stone-500">Ficha Técnica & Procedimiento de Preparación</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const r = selectedReceta;
                    setSelectedReceta(null);
                    handleOpenModal(r);
                  }}
                  className="p-2 rounded-xl text-amber-800 hover:bg-amber-100/60 transition-colors flex items-center gap-1 text-xs font-semibold"
                >
                  <Edit2 className="w-4 h-4" /> <span className="hidden sm:inline">Editar</span>
                </button>
                <button
                  onClick={() => setSelectedReceta(null)}
                  className="p-2 rounded-xl bg-stone-200/80 hover:bg-red-500 hover:text-white text-stone-700 transition-all font-bold"
                  title="Cerrar ventana (ESC)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Imagen Destacada */}
            <div className="relative h-48 w-full rounded-2xl overflow-hidden mb-4 border border-white/60">
              <img
                src={selectedReceta.url_foto_drive || 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600'}
                alt={selectedReceta.nombre_receta}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Escalador de porciones */}
            <div className="glass-panel p-4 rounded-xl mb-4 bg-amber-500/10 border-amber-500/30 flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider">Escalar Porciones Deseadas</label>
                <p className="text-xs text-stone-600">Base estándar: {selectedReceta.porciones_base} porciones</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={scalePortions}
                  onChange={(e) => setScalePortions(Math.max(1, Number(e.target.value)))}
                  className="w-20 glass-input px-3 py-1.5 rounded-xl text-center font-bold text-sm"
                />
                <span className="text-xs text-stone-600">porciones</span>
              </div>
            </div>

            {/* Tabla de Ingredientes Escalados */}
            <div className="space-y-3 mb-6">
              <h4 className="font-bold text-stone-800 text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-700" />
                Ingredientes Necesarios:
              </h4>
              <div className="divide-y divide-stone-200/60 glass-panel rounded-xl overflow-hidden p-2">
                {todosDetalles
                  ?.filter(d => d.id_receta === selectedReceta.id_receta)
                  .map((det) => {
                    const insumo = insumos?.find(i => i.id_insumo === det.id_insumo);
                    const cantEscalada = escalarCantidadInsumo(selectedReceta.porciones_base, scalePortions, det.cantidad_requerida);
                    const costoInsumoEscalado = cantEscalada * (Number(insumo?.costo_unidad_promedio) || 0);

                    return (
                      <div key={det.id_detalle} className="p-2.5 flex items-center justify-between text-xs">
                        <span className="font-semibold text-stone-800">{insumo?.nombre || det.id_insumo}</span>
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-stone-700 bg-amber-100/50 px-2 py-0.5 rounded-md font-semibold">
                            {cantEscalada} {insumo?.unidad_medida}
                          </span>
                          <span className="font-mono text-amber-900 font-bold min-w-[70px] text-right">
                            {formatCurrency(costoInsumoEscalado)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Lectura Directa Interna del Procedimiento */}
            <div className="space-y-2 mb-6">
              <h4 className="font-bold text-stone-800 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-700" />
                Procedimiento de Preparación:
              </h4>
              <div className="glass-panel p-4 rounded-xl bg-white/60 text-xs text-stone-800 leading-relaxed whitespace-pre-wrap font-sans max-h-60 overflow-y-auto border border-white/70">
                {selectedReceta.instrucciones || (
                  <span className="italic text-stone-500">No hay instrucciones redactadas para esta receta aún. Haz clic en Editar para agregarlas.</span>
                )}
              </div>
            </div>

            {/* Pie del Visor con Botón de Salida */}
            <div className="pt-4 border-t border-stone-200/50 flex justify-between items-center">
              {selectedReceta.doc_id_instrucciones ? (
                <a
                  href={`https://docs.google.com/document/d/${selectedReceta.doc_id_instrucciones}/edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                >
                  Abrir en Google Docs <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : <div></div>}

              <button
                onClick={() => setSelectedReceta(null)}
                className="glass-btn-secondary px-5 py-2 rounded-xl text-xs font-bold text-stone-700"
              >
                Cerrar Visor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nueva / Editar Receta */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200/50 mb-4">
              <h3 className="font-bold text-lg text-stone-800 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-700" />
                {editingReceta ? 'Editar Receta' : 'Crear Nueva Receta'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReceta} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Nombre de la Preparación</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Torta Selva Negra 24cm"
                  value={nombreReceta}
                  onChange={(e) => setNombreReceta(e.target.value)}
                  className="w-full glass-input px-3.5 py-2 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Porciones Base Rango</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={porcionesBase}
                    onChange={(e) => setPorcionesBase(e.target.value)}
                    className="w-full glass-input px-3.5 py-2 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">URL Fotografía (Drive / Enlace Web)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={fotoUrl}
                    onChange={(e) => setFotoUrl(e.target.value)}
                    className="w-full glass-input px-3.5 py-2 rounded-xl text-sm"
                  />
                </div>
              </div>

              {/* Insumos dinámicos */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-stone-800">Insumos Requeridos</label>
                  <button
                    type="button"
                    onClick={handleAddIngredienteRow}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Insumo
                  </button>
                </div>

                {ingredientesSeleccionados.map((row, idx) => {
                  const insumoObj = insumos?.find(i => i.id_insumo === row.id_insumo);
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        required
                        value={row.id_insumo}
                        onChange={(e) => handleUpdateIngredienteRow(idx, 'id_insumo', e.target.value)}
                        className="flex-1 glass-input px-3 py-1.5 rounded-xl text-xs"
                      >
                        <option value="">-- Seleccionar Insumo --</option>
                        {insumos?.map(i => (
                          <option key={i.id_insumo} value={i.id_insumo}>{i.nombre} ({i.unidad_medida})</option>
                        ))}
                      </select>

                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        required
                        placeholder={`Cant (${insumoObj ? insumoObj.unidad_medida : ''})`}
                        value={row.cantidad_requerida}
                        onChange={(e) => handleUpdateIngredienteRow(idx, 'cantidad_requerida', e.target.value)}
                        className="w-28 glass-input px-3 py-1.5 rounded-xl text-xs"
                      />

                      <button
                        type="button"
                        onClick={() => handleRemoveIngredienteRow(idx)}
                        className="p-1.5 text-stone-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Procedimiento */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Procedimiento & Notas de Preparación (Se muestra en la app y se sincroniza con Google Docs)</label>
                <textarea
                  rows="4"
                  placeholder="Paso 1. Batir los huevos con el azúcar hasta blanquear... Paso 2..."
                  value={instruccionesText}
                  onChange={(e) => setInstruccionesText(e.target.value)}
                  className="w-full glass-input p-3 rounded-xl text-xs font-sans"
                ></textarea>
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
                  <span>{editingReceta ? 'Guardar Cambios' : 'Crear Receta'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
