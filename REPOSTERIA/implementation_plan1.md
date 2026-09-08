# Implementation Plan: Repostería PWA (Google Workspace Headless Backend & Offline-First)

Desarrollo de una Progressive Web App (PWA) instalable para la gestión operativa, inventarios, compras, recetario y costeo en tiempo real para repostería, utilizando Google Workspace (Sheets, Docs, Drive) como backend serverless sin costos de infraestructura, Dexie.js (IndexedDB) para capacidad Offline-First con cola de sincronización, y un sistema de diseño Glassmorphism con Tailwind CSS.

## User Review Required

> [!IMPORTANT]
> **Autenticación y Google APIs**: Para interactuar con las APIs de Google (Sheets, Docs, Drive), el usuario necesitará un **Google Client ID** de OAuth 2.0 (configurado en Google Cloud Console con los scopes correspondientes). La aplicación incluirá una vista/modal de configuración donde el usuario podrá ingresar su Client ID o utilizar uno preconfigurado vía variables de entorno (`VITE_GOOGLE_CLIENT_ID`).

> [!NOTE]
> **Estructura de Archivos**: Se construirá la aplicación directamente dentro de la carpeta `REPOSTERIA/`, siguiendo estrictamente la arquitectura especificada en la sección 8 del documento técnico.

---

## Proposed Changes

### FASE 1: Scaffolding, Estructura de Proyecto y Sistema de Diseño Glassmorphism (Pasos 1 y 2)

#### [NEW] [package.json](file:///c:/Users/adecu/Documents/tienda-punto-crochet/REPOSTERIA/package.json)
- Configuración de proyecto Vite con React, Lucide Icons (`lucide-react`), Dexie.js (`dexie`, `dexie-react-hooks`), Tailwind CSS (`tailwindcss`, `@tailwindcss/vite` o PostCSS), y configuración PWA.

#### [NEW] [vite.config.js](file:///c:/Users/adecu/Documents/tienda-punto-crochet/REPOSTERIA/vite.config.js)
- Configuración de Vite con React plugin y servidor dev.

#### [NEW] [index.html](file:///c:/Users/adecu/Documents/tienda-punto-crochet/REPOSTERIA/index.html)
- HTML5 principal con meta tags para PWA, fuentes Google (Inter / Outfit), script de Google Identity Services (`https://accounts.google.com/gsi/client`), y registro de Service Worker.

#### [NEW] [public/manifest.json](file:///c:/Users/adecu/Documents/tienda-punto-crochet/REPOSTERIA/public/manifest.json)
- Web App Manifest para habilitar la instalación como PWA en Android y PC (display standalone, colores de tema pastel/cálidos, iconos).

#### [NEW] [src/sw.js](file:///c:/Users/adecu/Documents/tienda-punto-crochet/REPOSTERIA/src/sw.js)
- Service Worker para cachear assets estáticos y permitir funcionamiento offline básico del shell de la aplicación.

#### [NEW] [src/assets/styles/glassmorphism.css](file:///c:/Users/adecu/Documents/tienda-punto-crochet/REPOSTERIA/src/assets/styles/glassmorphism.css)
- Definición de estilos CSS y utilidades para el tema Glassmorphism (backdrop blur, transparencias rgba, gradientes cálidos, bordes brillantes sutiles, scrollbars personalizados).

---

### FASE 2: Capa de Servicios Backend Google Workspace (Pasos 3 y 4)

#### [NEW] [src/services/googleAuth.js](file:///c:/Users/adecu/Documents/tienda-punto-crochet/REPOSTERIA/src/services/googleAuth.js)
- Integración con Google Identity Services (GIS) usando el flujo OAuth 2.0 PKCE / Implicit Token Client.
- Manejo de login, logout, renovación de access token y persistencia en sesión local.

#### [NEW] [src/services/driveService.js](file:///c:/Users/adecu/Documents/tienda-punto-crochet/REPOSTERIA/src/services/driveService.js)
- Gestión de carpetas en Google Drive: `ReposteriaApp_Data`, `/Fotos_Recetas/` y `/Documentos_Recetas/`.
- Subida de imágenes (fotografías de recetas) y obtención de enlaces públicos/de visualización.

#### [NEW] [src/services/sheetsService.js](file:///c:/Users/adecu/Documents/tienda-punto-crochet/REPOSTERIA/src/services/sheetsService.js)
- Creación e inicialización del Google Sheet maestro con las 5 pestañas relacionales (`Insumos`, `Compras`, `Recetas`, `Detalle_Recetas`, `Produccion`).
- Operaciones CRUD completas mediante la API de Google Sheets.

#### [NEW] [src/services/docsService.js](file:///c:/Users/adecu/Documents/tienda-punto-crochet/REPOSTERIA/src/services/docsService.js)
- Creación y edición de documentos en Google Docs para instrucciones y procedimientos enriquecidos de recetas.

---

### FASE 3: Capa Offline-First & Sincronización (Paso 5)

#### [NEW] [src/services/dbLocal.js](file:///c:/Users/adecu/Documents/tienda-punto-crochet/REPOSTERIA/src/services/dbLocal.js)
- Definición del esquema IndexedDB con Dexie.js para espejar las 5 colecciones de datos + la cola de mutaciones (`sync_queue`) y `settings`.

#### [NEW] [src/utils/syncManager.js](file:///c:/Users/adecu/Documents/tienda-punto-crochet/REPOSTERIA/src/utils/syncManager.js)
- Detección de conectividad `online` / `offline`.
- Despacho y vaciado secuencial de la cola de sincronización `sync_queue` hacia Google Workspace APIs al reconectarse.

#### [NEW] [src/utils/calculations.js](file:///c:/Users/adecu/Documents/tienda-punto-crochet/REPOSTERIA/src/utils/calculations.js)
- Lógica de negocio pura:
  - Recálculo de costo promedio ponderado tras nueva compra.
  - Cálculo de costo total de receta basado en insumos requeridos.
  - Escalado de porciones y validación/descuento de inventario para preparaciones.

---

### FASE 4: Componentes Reutilizables y Vistas Principales (Paso 6)

#### [NEW] [src/components/GlassCard.jsx](file:///c:/Users/adecu/Documents/tienda-punto-crochet/REPOSTERIA/src/components/GlassCard.jsx)
- Contenedor con efecto cristal translúcido, bordes suaves y sombra sutil.

#### [NEW] [src/components/Navbar.jsx](file:///c:/Users/adecu/Documents/tienda-punto-crochet/REPOSTERIA/src/components/Navbar.jsx) y [src/components/Sidebar.jsx](file:///c:/Users/adecu/Documents/tienda-punto-crochet/REPOSTERIA/src/components/Sidebar.jsx)
- Navegación responsive: Tab bar flotante inferior para dispositivos móviles y barra lateral colapsable para escritorio.

#### [NEW] [src/components/SyncIndicator.jsx](file:///c:/Users/adecu/Documents/tienda-punto-crochet/REPOSTERIA/src/components/SyncIndicator.jsx)
- Indicador visual de estado de red (Online/Offline) y cantidad de cambios pendientes en la cola de sincronización.

#### [NEW] [src/views/Dashboard.jsx](file:///c:/Users/adecu/Documents/tienda-punto-crochet/REPOSTERIA/src/views/Dashboard.jsx)
- Resumen ejecutivo: Alertas de stock crítico, últimas preparaciones, costo promedio de insumos clave y acceso rápido.

#### [NEW] [src/views/Inventario.jsx](file:///c:/Users/adecu/Documents/tienda-punto-crochet/REPOSTERIA/src/views/Inventario.jsx)
- Gestión de insumos (creación, edición, nivel mínimo, unidades de medida `gramos`/`mililitros`/`unidades`).

#### [NEW] [src/views/Compras.jsx](file:///c:/Users/adecu/Documents/tienda-punto-crochet/REPOSTERIA/src/views/Compras.jsx)
- Registro de compras, recálculo automático de costo promedio e insumos, y comparador interactivo de proveedores.

#### [NEW] [src/views/Recetario.jsx](file:///c:/Users/adecu/Documents/tienda-punto-crochet/REPOSTERIA/src/views/Recetario.jsx)
- Catálogo de recetas, creación/edición con foto, insumos, cálculo de costos en tiempo real y visor de procedimiento vinculante a Google Docs.

#### [NEW] [src/views/Preparacion.jsx](file:///c:/Users/adecu/Documents/tienda-punto-crochet/REPOSTERIA/src/views/Preparacion.jsx)
- Módulo para ejecutar nuevas preparaciones: selección de receta, número de porciones, validación de stock disponible con alertas de faltante y descuento automático de inventario.

---

## Verification Plan

### Automated Tests / Builds
- Compilación de producción con `npm run build` o `npx vite build` para comprobar que no existan errores de sintaxis o importación.

### Manual Verification
- Probar el tema Glassmorphism responsive en vista de escritorio y móvil.
- Probar la interacción offline simulada (guardar en Dexie IndexedDB y verificar cola de sincronización).
- Probar las fórmulas de cálculo de costo ponderado, costo de receta y descuento proporcional de inventario.
