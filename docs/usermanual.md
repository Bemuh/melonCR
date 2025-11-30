# Manual de Usuario - Melon Clinic Records

Bienvenido a **Melon Clinic Records**, su aplicación para la gestión de historias clínicas. Este manual le guiará a través de las funciones principales del sistema.

---

## 1. Introducción

Melon Clinic es una aplicación diseñada para médicos y consultorios pequeños que necesitan llevar un registro clínico digital, seguro y sin depender de una conexión a internet constante.

**Características clave:**
- **Privacidad total:** Sus datos se guardan encriptados en su propio equipo.
- **Funcionamiento Offline:** No requiere internet para funcionar.
- **Gestión integral:** Desde el ingreso del paciente hasta la impresión de la fórmula médica.

---

## 2. Inicio y Acceso

### Primer Inicio
Al abrir la aplicación por primera vez, deberá crear su cuenta de usuario:
1. Ingrese un **Nombre de Usuario** y una **Contraseña** segura.
2. El sistema generará un **Código de Recuperación**.
   > **⚠️ IMPORTANTE:** Guarde este código en un lugar seguro. Si olvida su contraseña, este código será la **única forma** de recuperar el acceso a sus datos.

### Iniciar Sesión
En los siguientes accesos, solo necesitará su usuario y contraseña.

### Cierre Automático
Por seguridad, si deja de usar la aplicación por un tiempo (por defecto 10 minutos), la sesión se cerrará automáticamente. Deberá ingresar su contraseña nuevamente para continuar.

---

## 3. Configuración del Perfil del Médico

Antes de atender pacientes, es importante configurar sus datos, ya que estos aparecerán en las historias clínicas y fórmulas impresas.

1. Vaya a la sección **Perfil** (o se le solicitará al inicio).
2. Complete los campos:
   - Nombre completo.
   - Registro médico / Licencia.
   - Especialidad.
   - Datos de contacto (Teléfono, Email, Dirección).
3. **Logo y Firma:** Puede cargar imágenes de su logo y su firma digitalizada para que aparezcan en los documentos PDF.
4. Haga clic en **Guardar**.

---

## 4. Navegación y Gestión de Pacientes

### Página de Ingreso (Inicio)
Desde aquí puede buscar pacientes existentes o crear uno nuevo.
- **Buscar:** Escriba el nombre o número de documento en la barra de búsqueda.
- **Nuevo Paciente:** Si el paciente no existe, haga clic en "Crear Paciente" y complete los datos básicos (Nombre, Documento, Fecha de Nacimiento, Sexo, Contacto).

### Historia del Paciente
Al seleccionar un paciente, accederá a su historia clínica. Aquí verá:
- **Datos del Paciente:** Resumen en la parte superior.
- **Historial de Atenciones:** Lista de consultas previas a la izquierda.
- **Nueva Atención:** Botón para iniciar una nueva consulta.

---

## 5. Registro de Atención (Consulta)

Al crear una nueva atención, encontrará varias secciones desplegables para registrar la información clínica:

1. **Motivo de Consulta y Enfermedad Actual:** Describa por qué viene el paciente.
2. **Antecedentes:** Personales, familiares, alérgicos, etc.
3. **Signos Vitales:** Tensión arterial, peso, talla (el IMC se calcula solo), frecuencia cardíaca, etc.
4. **Examen Físico:** Hallazgos de la exploración.
5. **Análisis y Plan:** Su interpretación médica y conducta a seguir.
6. **Diagnósticos:**
   - Busque diagnósticos por código CIE-10 o nombre.
   - Seleccione si es "Principal" o "Relacionado".
   - Indique la finalidad de la consulta y causa externa (requerido para RIPS).
7. **Fórmula Médica:**
   - Agregue medicamentos indicando principio activo, dosis, frecuencia y duración.
   - El sistema calcula la cantidad total sugerida.
8. **Procedimientos:**
   - Registre procedimientos menores realizados.
   - Puede generar e imprimir el **Consentimiento Informado**.

---

## 6. Exportar e Imprimir

### Historia Clínica
Para generar un PDF de la historia completa del paciente (o de la atención actual):
- Haga clic en el botón de **Imprimir** (icono de impresora) en la barra superior de la atención.
- Se abrirá una vista previa en formato carta.

### Fórmula Médica
Para imprimir solo la receta médica:
- Vaya a la sección de "Fórmula Médica".
- Haga clic en el botón **Imprimir Fórmula**.
- El PDF incluirá su firma (si la configuró) y los medicamentos prescritos.

---

## 7. Seguridad y Configuración Adicional

En la pestaña **Seguridad** o **Configuración**:

- **Cambiar Contraseña:** Actualice su clave de acceso.
- **Tiempo de Inactividad:** Ajuste cuántos minutos deben pasar antes de que la aplicación se bloquee automáticamente.

---

## 8. Copias de Seguridad (Backups)

Sus datos viven en un archivo en su computadora.

- **Respaldo Automático:** La aplicación guarda cada cambio automáticamente en el archivo encriptado.
- **Respaldo Manual:** Se recomienda copiar periódicamente su archivo de base de datos (o usar la opción "Exportar" si está disponible) a una memoria USB o nube segura como copia de seguridad externa.

> **Nota:** El archivo de base de datos está encriptado. Nadie podrá leerlo sin su contraseña o código de recuperación.
