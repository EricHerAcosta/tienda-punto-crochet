import React from 'react';
import { LayoutDashboard, Package, ShoppingBag, BookOpen, ChefHat } from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
  { id: 'inventario', label: 'Inventario', icon: Package },
  { id: 'compras', label: 'Compras', icon: ShoppingBag },
  { id: 'recetario', label: 'Recetario', icon: BookOpen },
  { id: 'preparacion', label: 'Preparación', icon: ChefHat },
];

export default function Sidebar({ activeView, onViewChange }) {
  return (
    <>
      {/* Sidebar para Escritorio (Desktop Lateral persistent) */}
      <aside className="hidden md:flex flex-col w-64 glass-panel border-r border-white/50 p-4 min-h-[calc(100vh-65px)]">
        <nav className="space-y-1.5 flex-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-md shadow-amber-900/10 scale-[1.02]'
                    : 'text-stone-700 hover:bg-white/50 hover:text-stone-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-amber-100' : 'text-stone-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer Info del Sidebar */}
        <div className="pt-4 border-t border-stone-200/50 text-center">
          <div className="glass-panel p-3 rounded-xl text-xs text-stone-600 space-y-1">
            <p className="font-semibold text-stone-800">Modo Offline Activo</p>
            <p className="text-[11px] text-stone-500">Datos resguardados en IndexedDB</p>
          </div>
        </div>
      </aside>

      {/* Tab Bar Flotante Inferior para Móviles (Thumb-friendly PWA UX) */}
      <nav className="md:hidden fixed bottom-3 left-3 right-3 z-40 glass-panel rounded-2xl p-1.5 border border-white/60 shadow-lg flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
