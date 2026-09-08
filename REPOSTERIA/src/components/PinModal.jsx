import React, { useState, useRef, useEffect } from 'react';
import { ShieldCheck, X, KeyRound, AlertCircle } from 'lucide-react';
import { googleAuthService } from '../services/googleAuth';

export default function PinModal({ isOpen, onClose, onSuccess }) {
  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  useEffect(() => {
    if (isOpen) {
      setPinDigits(['', '', '', '']);
      setErrorMsg('');
      setTimeout(() => {
        inputRefs[0].current?.focus();
      }, 150);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const val = value.slice(-1);
    const nextDigits = [...pinDigits];
    nextDigits[index] = val;
    setPinDigits(nextDigits);
    setErrorMsg('');

    if (val && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    // Si ya completó los 4 dígitos, verificar automáticamente
    const fullPin = nextDigits.join('');
    if (fullPin.length === 4) {
      if (googleAuthService.verifyPin(fullPin)) {
        onSuccess();
      } else {
        setErrorMsg('PIN incorrecto. Inténtalo nuevamente.');
        setPinDigits(['', '', '', '']);
        setTimeout(() => inputRefs[0].current?.focus(), 100);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const fullPin = pinDigits.join('');
    if (fullPin.length !== 4) {
      setErrorMsg('Ingresa un PIN completo de 4 dígitos.');
      return;
    }
    if (googleAuthService.verifyPin(fullPin)) {
      onSuccess();
    } else {
      setErrorMsg('PIN incorrecto. Inténtalo nuevamente.');
      setPinDigits(['', '', '', '']);
      setTimeout(() => inputRefs[0].current?.focus(), 100);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-sm rounded-3xl p-6 shadow-2xl relative border border-white/60 text-stone-800 animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 transition-colors"
          title="Cerrar modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center space-y-3 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-800 flex items-center justify-center shadow-inner">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-extrabold text-xl text-stone-800">Verificación de Autorización</h3>
            <p className="text-xs text-stone-500 mt-1">
              Ingresa el PIN de 4 dígitos para acceder a la Configuración del Client ID
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center items-center gap-3">
            {pinDigits.map((digit, idx) => (
              <input
                key={idx}
                ref={inputRefs[idx]}
                type="password"
                maxLength={1}
                inputMode="numeric"
                pattern="[0-9]*"
                value={digit}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className="w-12 h-14 text-center text-2xl font-bold font-mono glass-input rounded-2xl border-2 border-stone-300/60 focus:border-amber-600 focus:ring-2 focus:ring-amber-500/30 transition-all shadow-inner"
              />
            ))}
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-700 text-xs font-semibold animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-2">
            <button
              type="submit"
              className="glass-btn-primary w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <KeyRound className="w-4 h-4" />
              <span>Verificar PIN</span>
            </button>
            <p className="text-[11px] text-stone-400 text-center">
              PIN predeterminado inicial: <span className="font-mono font-bold text-amber-800">1234</span>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
