# melon-clinic-records — Historia Clínica Offline (Electron + Encrypted DB)

Aplicación de escritorio para gestión de historias clínicas ambulatorias, diseñada para consultorios pequeños.  
Combina la flexibilidad de una **Single Page Application (React)** con la seguridad y privacidad de una **aplicación de escritorio (Electron)** con base de datos local encriptada.

[📘 **Manual de Usuario (Documentación para Médicos)**](docs/usermanual.md)

---

## Características principales

- **Seguridad y Privacidad**
  - **Base de datos encriptada:** Cada usuario tiene su propio archivo de base de datos encriptado con AES-256-GCM.
  - **Acceso protegido:** Sistema de login con contraseña y código de recuperación.
  - **Cierre automático:** Temporizador de inactividad configurable para cerrar sesión automáticamente.
  - **Offline First:** Funciona sin conexión a internet.

- **Gestión Clínica**
  - **Pacientes:** Búsqueda rápida, creación y edición.
  - **Atenciones (Encounters):** Registro completo (Motivo, Enfermedad Actual, Antecedentes, Examen Físico, Diagnósticos CIE-10, Plan).
  - **Fórmulas Médicas:** Generación e impresión de recetas con cálculo de cantidades.
  - **Procedimientos:** Registro de procedimientos menores y generación de consentimientos informados.
  - **Adjuntos:** Soporte para adjuntar archivos a la historia clínica.

- **Impresión y Exportación**
  - **Historia Clínica PDF:** Formato profesional, paginado y listo para imprimir.
  - **Fórmulas PDF:** Diseño claro para farmacia y paciente.
  - **Respaldo:** Exportación manual de la base de datos completa.

---

## Tecnologías

- **Core:** [Electron](https://www.electronjs.org/) (Runtime de escritorio).
- **Frontend:** [React](https://react.dev/) + [Vite](https://vitejs.dev/).
- **Base de Datos:** [sql.js](https://sql.js.org/) (SQLite compilado a WebAssembly).
- **Persistencia:**
  - **Modo Escritorio:** File System Access API (archivo encriptado en disco).
  - **Modo Web (Dev):** IndexedDB (vía `idb-keyval`).
- **Cifrado:** Web Crypto API (PBKDF2 para derivación de claves, AES-GCM para cifrado).
- **Testing:** [Playwright](https://playwright.dev/) (E2E).

---

## Requisitos de Desarrollo

- **Node.js:** v18+ (LTS recomendado).
- **npm:** Incluido con Node.js.

---

## Configuración y Ejecución

### 1. Instalación de dependencias

```bash
npm install
```

### 2. Modo Desarrollo

Para trabajar en la interfaz (modo navegador, sin funcionalidades nativas de Electron como encriptación de archivos en disco):

```bash
npm run dev
# Abre http://localhost:5173
```

Para probar la aplicación completa en Electron (con hot-reload del frontend):

```bash
npm run desktop:dev
```
*Nota: En este modo, la base de datos se guarda en la carpeta del proyecto o en datos de usuario de la app de desarrollo.*

### 3. Construcción (Build)

Para generar el ejecutable portátil para Windows:

```bash
npm run desktop:build
# El ejecutable se generará en la carpeta `release/`
```

---

## Persistencia y Seguridad

La aplicación utiliza un modelo de **"Base de Datos por Usuario"**.

1. **Creación de Cuenta:**
   - Se genera una `Master Key` aleatoria.
   - Esta llave se encripta con la contraseña del usuario (derivada con PBKDF2) y se guarda en el perfil del usuario.
   - Se genera un **Código de Recuperación** que también encripta una copia de la `Master Key`.

2. **Almacenamiento:**
   - La base de datos SQLite completa se serializa a un `Uint8Array`.
   - Se encripta usando la `Master Key` con AES-GCM.
   - Se guarda en el disco local del usuario (junto al ejecutable en modo portátil o en `AppData` según configuración).

3. **Inactividad:**
   - La aplicación monitorea eventos de ratón y teclado.
   - Si no hay actividad por el tiempo configurado (default 10 min), se cierra la sesión y se descarga la clave de memoria.

---

## Testing

El proyecto utiliza **Playwright** para pruebas de extremo a extremo (E2E).

```bash
# Ejecutar todos los tests (headless)
npm run test:run

# Ejecutar tests con interfaz gráfica (útil para depurar)
npm run test:ui
```

---

## Estructura del Proyecto

- `src/`
  - `auth/`: Lógica de autenticación y criptografía (`AuthContext`).
  - `components/`: Componentes React reutilizables.
  - `db/`: Capa de base de datos (`sql.js` + persistencia).
  - `pages/`: Vistas principales (PatientPage, LoginPage, etc.).
  - `electron/`: Proceso principal de Electron (`main.cjs`, `preload.cjs`).
- `e2e/`: Tests de Playwright.
- `docs/`: Documentación adicional y manual de usuario.

---

## Licencia

Propiedad privada. Todos los derechos reservados.
