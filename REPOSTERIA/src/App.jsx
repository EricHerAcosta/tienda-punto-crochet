import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './views/Dashboard';
import Inventario from './views/Inventario';
import Compras from './views/Compras';
import Recetario from './views/Recetario';
import Preparacion from './views/Preparacion';
import PinModal from './components/PinModal';
import { initLocalDbWithSeedData } from './services/dbLocal';
import { googleAuthService } from './services/googleAuth';
import { syncManager } from './utils/syncManager';
import { Settings, Key, RefreshCw, X, Check, Save, ShieldCheck, Lock } from 'lucide-react';

export default function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [showPinModal, setShowPinModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [clientIdInput, setClientIdInput] = useState(googleAuthService.getClientId());
  const [newPinInput, setNewPinInput] = useState('');
  const [pinChangeStatus, setPinChangeStatus] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    // Inicializar IndexedDB con datos semilla si es la primera ejecución
    initLocalDbWithSeedData();

    // Intentar inicializar Google Auth si hay Client ID guardado
    const clientId = googleAuthService.getClientId();
    if (clientId && window.google?.accounts?.oauth2) {
      googleAuthService.init();
    }
  }, []);

  const handleOpenSettingsRequest = () => {
    setShowPinModal(true);
  };

  const handlePinSuccess = () => {
    setShowPinModal(false);
    setClientIdInput(googleAuthService.getClientId());
    setNewPinInput('');
    setPinChangeStatus('');
    setShowSettingsModal(true);
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    googleAuthService.setClientId(clientIdInput);

    if (newPinInput.trim()) {
      if (newPinInput.trim().length === 4 && /^\d+$/.test(newPinInput.trim())) {
        googleAuthService.setPin(newPinInput.trim());
        setPinChangeStatus('PIN actualizado correctamente.');
      } else {
        alert('El nuevo PIN debe contener exactamente 4 dígitos numéricos.');
        return;
      }
    }

    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      setShowSettingsModal(false);
    }, 1200);
  };

  const handlePullGoogleData = async () => {
    if (!googleAuthService.isLoggedIn()) {
      alert('Debes iniciar sesión con Google primero.');
      return;
    }
    await syncManager.pullFromGoogleWorkspace();
    alert('¡Datos descargados de Google Workspace correctamente!');
  };

  return (
    <div className="min-h-screen flex flex-col selection:bg-amber-200">
      {/* Header / Navbar Global */}
      <Navbar onOpenSettings={handleOpenSettingsRequest} />

      {/* Body Container */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto pb-20 md:pb-6">
        {/* Navigation Sidebar */}
        <Sidebar activeView={activeView} onViewChange={setActiveView} />

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          {activeView === 'dashboard' && <Dashboard onViewChange={setActiveView} />}
          {activeView === 'inventario' && <Inventario />}
          {activeView === 'compras' && <Compras />}
          {activeView === 'recetario' && <Recetario />}
          {activeView === 'preparacion' && <Preparacion />}
        </main>
      </div>

      {/* Modal de Verificación por PIN */}
      <PinModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={handlePinSuccess}
      />

      {/* Modal de Configuración Google Workspace & Client ID */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl relative border border-white/60">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200/50 mb-4">
              <h3 className="font-bold text-lg text-stone-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-700" />
                Configuración de Seguridad & Google API
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-amber-700" /> Google OAuth Client ID (Guardado Fijo)
                </label>
                <input
                  type="text"
                  placeholder="ej. 123456789-abc.apps.googleusercontent.com"
                  value={clientIdInput}
                  onChange={(e) => setClientIdInput(e.target.value)}
                  className="w-full glass-input px-3.5 py-2 rounded-xl text-xs font-mono"
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  Esta dirección se guarda fijamente y no tendrás que volver a escribirla.
                </p>
              </div>

              <div className="pt-3 border-t border-stone-200/50 space-y-2">
                <label className="block text-xs font-semibold text-stone-700 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-700" /> Cambiar PIN de Acceso de 4 Dígitos
                </label>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="Nuevo PIN de 4 dígitos (Opcional)"
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  className="w-full glass-input px-3.5 py-2 rounded-xl text-xs font-mono text-center tracking-widest"
                />
                {pinChangeStatus && (
                  <p className="text-[11px] text-emerald-700 font-semibold">{pinChangeStatus}</p>
                )}
              </div>

              <div className="pt-2 border-t border-stone-200/50 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handlePullGoogleData}
                  className="glass-btn-secondary w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-stone-600" />
                  Descargar Datos de Google Workspace a IndexedDB
                </button>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-stone-200/50">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="glass-btn-secondary px-4 py-2 rounded-xl text-xs font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="glass-btn-primary px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  {isSaved ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>¡Guardado!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Guardar Configuración</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

