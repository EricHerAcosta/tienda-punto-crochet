import React, { useState, useEffect } from 'react';
import { Cake, User, LogIn, LogOut, Settings, Key } from 'lucide-react';
import SyncIndicator from './SyncIndicator';
import { googleAuthService } from '../services/googleAuth';

export default function Navbar({ onOpenSettings }) {
  const [user, setUser] = useState(googleAuthService.getUser());
  const [isLoggedIn, setIsLoggedIn] = useState(googleAuthService.isLoggedIn());

  useEffect(() => {
    const checkAuth = () => {
      setUser(googleAuthService.getUser());
      setIsLoggedIn(googleAuthService.isLoggedIn());
    };
    window.addEventListener('storage', checkAuth);
    const interval = setInterval(checkAuth, 2000);
    return () => {
      window.removeEventListener('storage', checkAuth);
      clearInterval(interval);
    };
  }, []);

  const handleLogin = () => {
    try {
      googleAuthService.login();
    } catch (err) {
      alert(err.message);
      onOpenSettings();
    }
  };

  const handleLogout = () => {
    googleAuthService.logout();
    setUser(null);
    setIsLoggedIn(false);
  };

  return (
    <header className="sticky top-0 z-30 w-full glass-panel border-b border-white/50 px-4 py-3 md:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-400 p-0.5 shadow-md flex items-center justify-center">
            <div className="w-full h-full bg-amber-50 rounded-[10px] flex items-center justify-center">
              <Cake className="w-5 h-5 text-amber-700" />
            </div>
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight bg-gradient-to-r from-stone-800 via-amber-900 to-amber-700 bg-clip-text text-transparent">
              DulceGestión
            </h1>
            <p className="text-[11px] text-stone-500 font-medium hidden sm:block">
              Repostería & Costeos PWA
            </p>
          </div>
        </div>

        {/* Right Section: Sync Status + Google Auth + Settings */}
        <div className="flex items-center gap-3">
          <SyncIndicator />

          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-white/50 transition-colors"
            title="Configuración Google Workspace"
          >
            <Settings className="w-5 h-5" />
          </button>

          {isLoggedIn ? (
            <div className="flex items-center gap-2 pl-2 border-l border-stone-300/60">
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt={user.name || 'Usuario'}
                  className="w-8 h-8 rounded-full border border-white shadow-sm"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-semibold">
                  <User className="w-4 h-4" />
                </div>
              )}
              <span className="text-xs font-medium text-stone-700 hidden md:inline max-w-[120px] truncate">
                {user?.name || user?.email || 'Conectado'}
              </span>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-stone-500 hover:text-red-600 hover:bg-red-50/50 transition-colors"
                title="Cerrar sesión de Google"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-800 text-stone-50 hover:bg-stone-900 shadow-sm transition-all"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Conectar Google</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
