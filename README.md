# Simulador PythonLab UNAD

Simulador web para ejecutar, revisar y retroalimentar código Python directamente desde el navegador.

## Funcionalidades

- Ejecución de Python en el navegador mediante **Pyodide**.
- Consola interactiva compatible con `input()`.
- Editor con numeración de líneas.
- Detección automática de la línea donde ocurre un error.
- Botón para ir directamente a la línea reportada por Python.
- Explicación automática de errores frecuentes sin depender de una IA externa.
- Generación de insignia cuando el código termina correctamente.
- Código QR en la insignia con el nombre del estudiante.
- Diseño institucional adaptable a escritorio y dispositivos móviles.

## Estructura del proyecto

```text
PythonLabUnad_GitHub/
├── index.html
├── README.md
├── .nojekyll
├── assets/
│   ├── logo-unad.png
│   └── pythonlab-icon.png
├── css/
│   └── styles.css
└── js/
    └── app.js
```

## Ejecutar localmente

Por seguridad del navegador y para evitar restricciones al abrir archivos directamente con `file://`,
se recomienda servir el proyecto con un servidor web local.

Si tienes Python instalado:

```bash
python -m http.server 8000
```

Luego abre en Google Chrome:

```text
http://localhost:8000
```

## Desplegar en GitHub Pages

1. Crea un repositorio nuevo en GitHub.
2. Sube **todo el contenido de esta carpeta** a la rama `main`.
3. En GitHub entra a **Settings > Pages**.
4. En **Build and deployment**, selecciona:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`
5. Guarda los cambios.
6. GitHub publicará el sitio en una dirección similar a:

```text
https://TU-USUARIO.github.io/NOMBRE-DEL-REPOSITORIO/
```

## Dependencias externas

El simulador carga desde CDN:

- Pyodide
- QRCode.js

Por lo tanto, el usuario necesita conexión a Internet para que el motor Python y el generador QR se carguen correctamente.

## Archivo principal

GitHub Pages detectará automáticamente:

```text
index.html
```

## Nota

El simulador ejecuta código Python en el navegador. Para actividades académicas públicas se recomienda definir claramente qué tipos de ejercicios y paquetes serán admitidos.
