````markdown
# melonCR — Historia Clínica offline (PWA + Electron)

Aplicación de historia clínica ambulatoria pensada para consultorios pequeños.  
Funciona como **PWA en el navegador** y como **aplicación de escritorio** empaquetada con Electron, sin depender de un servidor.

---

## Características principales

- **Ingreso de pacientes**
  - Búsqueda por documento / nombre.
  - Creación de pacientes nuevos con validación básica de duplicados.

- **Atenciones (encounters) por paciente**
  - Múltiples atenciones por paciente (primera vez, control, procedimientos menores).
  - Secciones por pestañas/accordion:
    1. Datos de contacto del paciente
    2. Motivo de consulta
    3. Enfermedad actual
    4. Antecedentes
    5. Signos vitales (con cálculo automático de IMC)
    6. Examen físico
    7. Análisis
    8. Plan / Conducta
    9. Diagnósticos CIE-10 (con búsqueda y finalidad/causa externa RIPS)
    10. Fórmula médica
    11. Procedimientos menores (CUPS) y consentimiento

- **Historia clínica impresa**
  - Vista `/print/:patientId` con toda la historia del paciente.
  - Formato **Carta**, orientación vertical, márgenes mínimos (ajustables en el diálogo de impresión).
  - Encabezado con datos de la médica y logo (configurables en `src/config/doctor.json` y `FullColor.png`).
  - Texto justificado y secciones impresas en el mismo orden que en la pantalla de paciente.

- **Fórmula médica impresa**
  - Vista `/rx/:encounterId` para imprimir sólo la fórmula del encuentro activo.
  - Cálculo automático de cantidad total sugerida.
  - Soporta tratamientos >30 días generando copias por bloques de 30 días.
  - Incluye espacio de firma y textos aclaratorios.

- **Almacenamiento de datos**
  - Base de datos SQLite embebida usando **sql.js**.
  - Persistencia en **IndexedDB** vía `idb-keyval` (clave `clinic_db_sqljs_v1`).
  - Esquema con tablas: `patients`, `encounters`, `diagnoses`, `prescriptions`, `procedures` y `attachments`.
  - Opción de respaldo a archivo fijo mediante File System Access API (cuando el navegador lo permite).

---

## Tecnologías

- **Frontend:** React 18, React Router DOM (`HashRouter`).
- **Bundler:** Vite.
- **Base de datos local:** sql.js (SQLite → WASM) + IndexedDB.
- **Estado puntual:** componentes con hooks; algunas ayudas con pequeños stores.
- **Escritorio:** Electron (ventana única, sin Node en el renderer, `preload.cjs` mínimo).
- **Estilos:** CSS plano en `src/styles.css`.

---

## Requisitos

- Node.js y npm instalados (versión LTS recomendada).

---

## Ejecución en modo web (desarrollo)

```bash
npm install
npm run dev
# Abrir: http://localhost:5173
````

---

## Build web (PWA)

```bash
npm run build      # genera /dist
npm run preview    # sirve la build en modo vista previa
```

El contenido de `dist/` puede desplegarse en cualquier servidor estático.

---

## Aplicación de escritorio (Electron)

```bash
# Desarrollo: compila la web y abre Electron apuntando al dev server
npm run desktop:dev

# Build portátil para Windows (EXE en /release)
npm run desktop:build

# Sólo empaquetar directorio (sin instalador)
npm run desktop:pack
```

Electron carga la misma build de Vite (`dist/index.html`) y respeta el modo offline de la PWA.

---

## Notas sobre datos y respaldos

* La base de datos se guarda automáticamente en IndexedDB; no hay backend.
* Es posible:

  * Exportar la base de datos como archivo `.sqljs` (descarga manual).
  * Elegir un archivo fijo de respaldo; cada operación de escritura lo actualiza (cuando el navegador/OS lo permite).

---

Última generación de este README de referencia: **2025-09-24**. 
