import React from 'react';

/**
 * Componente contenedor Glassmorphism reutilizable con efecto translúcido y elevación sutil.
 */
export default function GlassCard({ children, className = '', interactive = false, ...props }) {
  const baseStyle = interactive ? 'glass-panel-interactive' : 'glass-panel';

  return (
    <div
      className={`${baseStyle} rounded-2xl p-5 md:p-6 transition-all duration-300 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
