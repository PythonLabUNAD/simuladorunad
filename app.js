const PYODIDE_INDEX = "https://cdn.jsdelivr.net/pyodide/v314.0.4/full/";

let pyodide = null;
let pyodidePromise = null;
let entradasUsuario = [];
let codigoActual = "";
let ultimoSVG = "";
let esperandoEntrada = false;
let sesionActiva = false;
let lineaErrorActual = null;
let ultimoErrorTexto = "";
let caracteresTipeados = 0;
let caracteresPegados = 0;
let ultimoLargoCodigo = 0;

const $ = id => document.getElementById(id);

const nombre = $("nombre");
const cc = $("cc");
const codigo = $("codigo");
const lineNumbers = $("lineNumbers");
const estadoMotor = $("estadoMotor");
const consoleText = $("consoleText");
const inputArea = $("inputArea");
const promptLabel = $("promptLabel");
const terminalInput = $("terminalInput");
const cursorMsg = $("cursorMsg");
const btnEjecutar = $("btnEjecutar");
const btnIrLinea = $("btnIrLinea");
const btnExplicarError = $("btnExplicarError");
const explainPanel = $("explainPanel");
const insignia = $("insignia");
const badgePreview = $("badgePreview");

function escXML(v){
  return String(v)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&apos;");
}

function calcularPorcentajes(){
  if(!codigo) return { pctManual: 100, pctPegado: 0 };
  const lenActual = codigo.value.length;
  if (!lenActual) {
    return { pctManual: 100, pctPegado: 0 };
  }

  const totalAccion = caracteresTipeados + caracteresPegados;
  if (totalAccion === 0) {
    return { pctManual: 100, pctPegado: 0 };
  }

  const pctManual = Math.max(0, Math.min(100, Math.round((caracteresTipeados / totalAccion) * 100)));
  const pctPegado = 100 - pctManual;

  return { pctManual, pctPegado };
}

function actualizarEstadisticasTipeo(){
  const badge = $("typingStats");
  if(!badge || !codigo) return;

  const codigoTexto = codigo.value;
  if(!codigoTexto.trim()){
    caracteresTipeados = 0;
    caracteresPegados = 0;
    ultimoLargoCodigo = 0;
    badge.className = "typing-stat-badge";
    badge.textContent = "✍️ Tipeo: 100% | Pegado: 0%";
    return;
  }

  const { pctManual, pctPegado } = calcularPorcentajes();

  if(pctManual >= 50){
    badge.className = "typing-stat-badge";
    badge.textContent = `✍️ Tipeo: ${pctManual}% | Pegado: ${pctPegado}%`;
  } else {
    badge.className = "typing-stat-badge pasted-mode";
    badge.textContent = `📋 Pegado: ${pctPegado}% | Tipeo: ${pctManual}%`;
  }
}

function setEstadoMotor(texto, tipo = "idle"){
  if(!estadoMotor) return;
  const dot = estadoMotor.querySelector(".status-dot");
  const textSpan = estadoMotor.querySelector(".status-text");
  estadoMotor.className = `estado-badge estado-${tipo}`;
  if(dot && textSpan){
    textSpan.textContent = texto;
  } else {
    estadoMotor.innerHTML = `<span class="status-dot"></span><span class="status-text">${escXML(texto)}</span>`;
  }
}

/* ---------- NÚMEROS DE LÍNEA ---------- */
function actualizarNumerosLinea(){
  const cantidad = Math.max(1, codigo.value.split("\n").length);
  const lineaCursor = obtenerLineaCursor();

  let html = "";
  for(let i=1;i<=cantidad;i++){
    const clase = i === lineaErrorActual
      ? "active-line"
      : "";
    html += `<div class="${clase}" data-line="${i}">${i}</div>`;
  }
  lineNumbers.innerHTML = html;
  lineNumbers.scrollTop = codigo.scrollTop;
}

function obtenerLineaCursor(){
  return codigo.value.substring(0,codigo.selectionStart).split("\n").length;
}

function irALinea(numero){
  numero = Number(numero);
  if(!Number.isFinite(numero) || numero < 1) return;

  const texto = codigo.value;
  const lineas = texto.split("\n");
  if(numero > lineas.length) return;

  let inicio = 0;
  for(let i=0;i<numero-1;i++){
    inicio += lineas[i].length + 1;
  }

  const fin = inicio + lineas[numero-1].length;

  codigo.focus();
  codigo.setSelectionRange(inicio,fin);

  const lineHeight = parseFloat(getComputedStyle(codigo).lineHeight) || 21.7;
  codigo.scrollTop = Math.max(0,(numero-4)*lineHeight);

  lineaErrorActual = numero;
  actualizarNumerosLinea();
}

function detectarLineaError(textoError){
  const patrones = [
    /File\s+"<codigo_estudiante>",\s+line\s+(\d+)/g,
    /<codigo_estudiante>.*?line\s+(\d+)/g,
    /line\s+(\d+)/g
  ];

  for(const patron of patrones){
    let match = null;
    let ultimo = null;
    while((match = patron.exec(textoError)) !== null){
      ultimo = match;
    }
    if(ultimo){
      return parseInt(ultimo[1],10);
    }
  }
  return null;
}

function prepararNavegacionError(error){
  const linea = detectarLineaError(error);
  lineaErrorActual = linea;
  ultimoErrorTexto = error || "";

  btnExplicarError.style.display = "inline-block";

  if(linea){
    btnIrLinea.textContent = `📍 Ir a línea ${linea}`;
    btnIrLinea.style.display = "inline-block";
    actualizarNumerosLinea();

    setTimeout(()=>irALinea(linea),150);
  }else{
    btnIrLinea.style.display = "none";
    actualizarNumerosLinea();
  }
}

codigo.addEventListener("paste", (e) => {
  const text = (e.clipboardData || window.clipboardData)?.getData("text") || "";
  if(text.length > 0){
    caracteresPegados += text.length;
    actualizarEstadisticasTipeo();
  }
});

codigo.addEventListener("input",(e)=>{
  lineaErrorActual = null;
  btnIrLinea.style.display = "none";
  ocultarExplicacion();
  actualizarNumerosLinea();

  const nuevoLargo = codigo.value.length;
  const delta = nuevoLargo - ultimoLargoCodigo;
  ultimoLargoCodigo = nuevoLargo;

  if(delta > 0 && e.inputType !== "insertFromPaste"){
    caracteresTipeados += delta;
    actualizarEstadisticasTipeo();
  } else if(nuevoLargo === 0){
    caracteresTipeados = 0;
    caracteresPegados = 0;
    actualizarEstadisticasTipeo();
  }
});

codigo.addEventListener("scroll",()=>{
  lineNumbers.scrollTop = codigo.scrollTop;
});

codigo.addEventListener("click",actualizarNumerosLinea);
codigo.addEventListener("keyup",actualizarNumerosLinea);

lineNumbers.addEventListener("click",(e)=>{
  const el = e.target.closest("[data-line]");
  if(el){
    irALinea(parseInt(el.dataset.line,10));
  }
});

btnIrLinea.addEventListener("click",()=>{
  if(lineaErrorActual) irALinea(lineaErrorActual);
});

btnExplicarError.addEventListener("click",()=>{
  mostrarExplicacionError();
});

/* ---------- CONSOLA ---------- */
function scrollConsola(){
  const consola = $("consola");
  setTimeout(()=>{ consola.scrollTop = consola.scrollHeight; },0);
}

function setConsole(texto, clase="console-info"){
  consoleText.textContent = texto;
  consoleText.className = clase;
  scrollConsola();
}

function mostrarInput(prompt){
  esperandoEntrada = true;
  promptLabel.textContent = prompt || "";
  inputArea.style.display = "flex";
  cursorMsg.textContent = "Escribe el dato y presiona Enter.";
  terminalInput.value = "";
  terminalInput.disabled = false;
  setTimeout(()=>terminalInput.focus(),50);
  scrollConsola();
}

function ocultarInput(){
  esperandoEntrada = false;
  inputArea.style.display = "none";
  promptLabel.textContent = "";
  cursorMsg.textContent = "";
}

function ocultarInsignia(){
  insignia.style.display = "none";
  badgePreview.innerHTML = "";
  ultimoSVG = "";
}

function ocultarExplicacion(){
  ultimoErrorTexto = "";
  explainPanel.style.display = "none";
  explainPanel.innerHTML = "";
  btnExplicarError.style.display = "none";
}

function escaparHTML(texto){
  return String(texto)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function obtenerTextoLinea(numero){
  if(!numero) return "";
  const lineas = codigo.value.split("\n");
  return lineas[numero - 1] || "";
}

function generarExplicacion(errorTexto) {
  if (!errorTexto) errorTexto = "";
  if (errorTexto.includes('IndexError')) {
    return 'Índice fuera de rango (IndexError): Estás intentando acceder a una posición que no existe en la lista o matriz. Recuerda que en Python las posiciones inician en 0 y terminan en longitud - 1.';
  }
  if (errorTexto.includes('ValueError')) {
    return 'Valor inválido (ValueError): La función esperaba un tipo de dato específico (por ejemplo un número en int() o float()), pero recibió un texto o formato incompatible.';
  }
  if (errorTexto.includes('KeyError')) {
    return 'Clave no encontrada (KeyError): Estás intentando acceder a una propiedad de un diccionario que no existe o está mal escrita.';
  }
  if (errorTexto.includes('IndentationError')) {
    return 'Error de indentación (IndentationError): Los bloques de código dentro de funciones, if, for o while deben tener exactamente la misma sangría (espacios al inicio).';
  }
  if (errorTexto.includes('ZeroDivisionError')) {
    return 'División por cero (ZeroDivisionError): Estás intentando dividir un número entre 0. Verifica los cálculos de promedios o totales.';
  }
  if (errorTexto.includes('UnboundLocalError')) {
    return 'Variable local no inicializada (UnboundLocalError): Intentas modificar una variable fuera de la función sin declararla como global.';
  }
  if (errorTexto.includes('AttributeError')) {
    return 'Atributo o método inválido (AttributeError): Estás aplicando un método que no pertenece a ese tipo de dato (por ejemplo usar .append() en un entero o diccionario).';
  }
  if (errorTexto.includes('NameError')) {
    return 'Nombre no definido (NameError): Usaste una variable o función que no existe o tiene errores de digitación (mayúsculas/minúsculas).';
  }
  if (errorTexto.includes('SyntaxError')) {
    return 'Error de sintaxis (SyntaxError): Falta un caracter estructural como dos puntos (:), cerrar paréntesis (), o cerrar comillas.';
  }
  if (errorTexto.includes('TypeError')) {
    return 'Error de tipos (TypeError): Intentas realizar una operación entre tipos incompatibles (por ejemplo sumar texto con números).';
  }
  return 'Revisa la estructura de tu código, los nombres de variables y la lógica de ejecución.';
}

function explicarError(errorTexto) {
  return generarExplicacion(errorTexto);
}

function construirExplicacionError(errorTexto){
  const lower = (errorTexto || "").toLowerCase();
  const linea = detectarLineaError(errorTexto);
  const lineaTexto = obtenerTextoLinea(linea);
  const explicacion = generarExplicacion(errorTexto || "");

  let tipo = "Error de ejecución";
  let causa = explicacion;
  let sugerencias = [
    "Revisa cuidadosamente la línea señalada y las líneas inmediatamente anteriores.",
    "Comprueba nombres de variables, operadores, paréntesis, comillas e indentación.",
    "Vuelve a ejecutar el programa después de corregir el error."
  ];
  let ejemplo = "";

  if(lower.includes("syntaxerror")){
    tipo = "SyntaxError";
    sugerencias = [
      "Verifica si falta un signo de dos puntos (:) en un if, for, while, def o else.",
      "Revisa paréntesis, comillas o llaves mal cerradas.",
      "Comprueba si escribiste mal una palabra clave o si dejaste una línea incompleta."
    ];
    ejemplo = "Ejemplo: if promedio >= 3:";
  } else if(lower.includes("indentationerror")){
    tipo = "IndentationError";
    sugerencias = [
      "Usa la misma cantidad de espacios en los bloques del if, for, while, def, etc.",
      "Evita mezclar tabulaciones con espacios.",
      "Alinea correctamente las líneas que pertenecen al mismo bloque."
    ];
    ejemplo = "Ejemplo:\nif promedio >= 3:\n    print(\"Aprobado\")";
  } else if(lower.includes("nameerror")){
    tipo = "NameError";
    sugerencias = [
      "Comprueba si el nombre está bien escrito.",
      "Asegúrate de haber creado la variable antes de usarla.",
      "Revisa mayúsculas y minúsculas, porque Python las diferencia."
    ];
  } else if(lower.includes("typeerror")){
    tipo = "TypeError";
    sugerencias = [
      "Revisa si estás sumando texto con números o pasando argumentos incorrectos.",
      "Convierte los datos cuando sea necesario con int(), float() o str().",
      "Comprueba que la función reciba la cantidad de argumentos esperada."
    ];
  } else if(lower.includes("valueerror")){
    tipo = "ValueError";
    sugerencias = [
      "Si usas int() o float(), verifica que el dato ingresado sea realmente numérico.",
      "Evita letras o símbolos cuando se espera un número.",
      "Valida los datos antes de convertirlos."
    ];
    ejemplo = "Ejemplo: float(\"4.5\") es válido, float(\"cuatro\") no lo es.";
  } else if(lower.includes("zerodivisionerror")){
    tipo = "ZeroDivisionError";
    sugerencias = [
      "Verifica el valor del divisor antes de hacer la operación.",
      "Agrega una condición para impedir la división entre cero.",
      "Muestra un mensaje al usuario si el divisor es 0."
    ];
  } else if(lower.includes("unboundlocalerror")){
    tipo = "UnboundLocalError";
    sugerencias = [
      "Declara la variable como global si deseas modificarla dentro de una función.",
      "Pasa la variable como parámetro o inicialízala localmente antes de usarla."
    ];
    ejemplo = "Ejemplo:\ncontador = 0\ndef incrementar():\n    global contador\n    contador += 1";
  } else if(lower.includes("indexerror")){
    tipo = "IndexError";
    sugerencias = [
      "Comprueba el tamaño de la lista con len().",
      "Recuerda que los índices empiezan en 0.",
      "No accedas a una posición mayor o igual al tamaño de la lista."
    ];
  } else if(lower.includes("keyerror")){
    tipo = "KeyError";
    sugerencias = [
      "Revisa si la clave está escrita correctamente.",
      "Usa diccionario.get(clave) si deseas evitar el error.",
      "Comprueba primero si la clave existe en el diccionario."
    ];
  } else if(lower.includes("modulenotfounderror")){
    tipo = "ModuleNotFoundError";
    sugerencias = [
      "Verifica que el nombre del módulo esté bien escrito.",
      "Comprueba si ese módulo está disponible en el entorno Pyodide.",
      "Si no es un módulo estándar, revisa si realmente puede usarse en este simulador."
    ];
  } else if(lower.includes("attributeerror")){
    tipo = "AttributeError";
    sugerencias = [
      "Comprueba el tipo de dato de la variable.",
      "Revisa si el método o atributo existe realmente para ese objeto.",
      "Asegúrate de escribir correctamente el nombre del método."
    ];
  } else if(lower.includes("eoferror")){
    tipo = "EOFError";
    sugerencias = [
      "Cuando aparezca el cuadro de entrada en la consola, escribe el valor y presiona Enter.",
      "No cierres ni reinicies la sesión mientras el programa espera datos.",
      "Verifica cuántos input() tiene el programa para ingresar todos los valores solicitados."
    ];
  }

  const sugerenciasHtml = sugerencias.map(s => `<li>${escaparHTML(s)}</li>`).join("");
  const saludoLinea = linea
    ? `¡Hola! Veo que tenemos un pequeño inconveniente en la línea ${linea}.`
    : `¡Hola! Veo que tenemos un pequeño inconveniente en la ejecución de tu código.`;

  const lineaCodigoHtml = lineaTexto
    ? `<div style="margin-top: 6px;"><code>Línea ${linea}: ${escaparHTML(lineaTexto)}</code></div>`
    : "";

  const ejemploHtml = ejemplo
    ? `<br><span class="terminal-header">📖 Ejemplo guía:</span><div>${escaparHTML(ejemplo).replaceAll("\n","<br>")}</div>`
    : "";

  return `
    <div><span class="terminal-prompt">&gt;</span> <span class="terminal-ia-character">🐍 Asistente UNAD:</span> ${saludoLinea}</div>
    <br>
    <div><span class="terminal-header">💡 Mi Consejo:</span></div>
    <div>Me parece que hay un <strong>${escaparHTML(tipo)}</strong>. ${escaparHTML(causa)}</div>
    ${lineaCodigoHtml}
    <br>
    <div><span class="terminal-header">🔧 Pasos para corregir:</span></div>
    <ul class="terminal-list">
      ${sugerenciasHtml}
    </ul>
    ${ejemploHtml}
    <br>
    <details class="terminal-technical-details">
      <summary>Ver detalles técnicos (para curiosos)</summary>
      <pre class="code-traceback">${escaparHTML(errorTexto)}</pre>
    </details>
  `;
}

function mostrarExplicacionError(){
  if(!ultimoErrorTexto) return;
  explainPanel.innerHTML = construirExplicacionError(ultimoErrorTexto);
  explainPanel.style.display = "block";
  scrollConsola();
}

async function cargarPython(){
  if(pyodide) return pyodide;
  if(pyodidePromise) return pyodidePromise;

  pyodidePromise = (async()=>{
    if(typeof loadPyodide !== "function"){
      throw new Error(
        "No se pudo cargar Pyodide. Compruebe la conexión a Internet o el acceso a jsDelivr."
      );
    }

    setEstadoMotor("⏳ Motor Python: cargando...", "loading");
    setConsole(
      "⏳ Cargando Python en el navegador...\n" +
      "La primera ejecución necesita conexión a Internet."
    );

    const p = await loadPyodide({indexURL:PYODIDE_INDEX});
    pyodide = p;
    setEstadoMotor("✅ Motor Python: listo", "ready");
    return p;
  })();

  try{
    return await pyodidePromise;
  }catch(e){
    pyodidePromise = null;
    throw e;
  }
}

function generarQRDataURL(texto){
  const contenedor = $("qrTemp");
  contenedor.innerHTML = "";

  if(typeof QRCode !== "function"){
    throw new Error("No se pudo cargar la librería para generar el código QR.");
  }

  new QRCode(contenedor,{
    text:texto,
    width:180,
    height:180,
    correctLevel:QRCode.CorrectLevel.H
  });

  const canvas = contenedor.querySelector("canvas");
  if(canvas) return canvas.toDataURL("image/png");

  const img = contenedor.querySelector("img");
  if(img && img.src) return img.src;

  throw new Error("No se pudo convertir el QR a imagen.");
}

function crearInsignia(nom, documento){
  const qrData = generarQRDataURL(nom);
  const fecha = new Date().toLocaleDateString("es-CO",{
    year:"numeric",month:"long",day:"numeric"
  });

  const { pctManual, pctPegado } = calcularPorcentajes();
  const selloTexto = pctManual >= 50
    ? `Composición: ${pctManual}% Tipeo manual | ${pctPegado}% Pegado`
    : `Composición: ${pctPegado}% Texto pegado | ${pctManual}% Tipeo manual`;
  const selloColor = pctManual >= 50 ? "#4ade80" : "#38bdf8";

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="560" viewBox="0 0 1000 560">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#14213d"/>
      <stop offset="100%" stop-color="#274c77"/>
    </linearGradient>
  </defs>
  <rect width="1000" height="560" rx="34" fill="url(#fondo)"/>
  <rect x="24" y="24" width="952" height="512" rx="26"
        fill="none" stroke="#f4b400" stroke-width="3"/>

  <circle cx="205" cy="138" r="70" fill="#f4b400"/>
  <text x="205" y="163" text-anchor="middle"
        font-family="Arial" font-size="72" font-weight="bold" fill="#ffffff">✓</text>

  <text x="390" y="112"
        font-family="Arial" font-size="36" font-weight="bold" fill="#ffffff">INSIGNIA PYTHON</text>

  <text x="390" y="156"
        font-family="Arial" font-size="20" fill="#dce8f8">Código ejecutado correctamente</text>

  <text x="90" y="280"
        font-family="Arial" font-size="17" fill="#aebfd7">ESTUDIANTE</text>

  <text x="90" y="325"
        font-family="Arial" font-size="30" font-weight="bold" fill="#ffffff">${escXML(nom)}</text>

  <text x="90" y="372"
        font-family="Arial" font-size="22" fill="#f4b400">CC: ${escXML(documento)}</text>

  <text x="90" y="425"
        font-family="Arial" font-size="17" fill="#dce8f8">Competencia: ejecución de código Python</text>

  <text x="90" y="460"
        font-family="Arial" font-size="15" fill="#aebfd7">${escXML(fecha)}</text>

  <text x="90" y="498"
        font-family="Arial" font-size="14" font-weight="bold" fill="${selloColor}">✍️ ${escXML(selloTexto)}</text>

  <rect x="725" y="245" width="205" height="205" rx="15" fill="#ffffff"/>
  <image href="${qrData}" x="738" y="258" width="180" height="180"/>

  <text x="827" y="482" text-anchor="middle"
        font-family="Arial" font-size="13" fill="#dce8f8">Escanea para ver el nombre</text>
</svg>`;
}

function mostrarInsignia(){
  try{
    ultimoSVG = crearInsignia(nombre.value.trim(),cc.value.trim());
    badgePreview.innerHTML = ultimoSVG;
    insignia.style.display = "block";
  }catch(e){
    insignia.style.display = "block";
    badgePreview.innerHTML =
      "<p>No fue posible crear el QR: " + escXML(e.message || String(e)) + "</p>";
  }
}

async function ejecutarSesion(esReanudacion=false){
  ocultarInsignia();
  ocultarInput();
  if(!esReanudacion) ocultarExplicacion();

  if(!esReanudacion){
    codigoActual = codigo.value;
    entradasUsuario = [];
    lineaErrorActual = null;
    btnIrLinea.style.display = "none";
    actualizarNumerosLinea();
  }

  const nom = nombre.value.trim();
  const documento = cc.value.trim();

  if(!nom){
    alert("Ingrese el nombre completo del estudiante.");
    nombre.focus();
    return;
  }
  if(!documento){
    alert("Ingrese la cédula o CC.");
    cc.focus();
    return;
  }
  if(!codigoActual.trim()){
    alert("Ingrese código Python.");
    codigo.focus();
    return;
  }

  btnEjecutar.disabled = true;
  sesionActiva = true;

  try{
    const py = await cargarPython();
    setEstadoMotor("⚙️ Motor Python: ejecutando", "running");

    try{
      await py.loadPackagesFromImports(codigoActual);
    }catch(pkgErr){
      throw new Error(
        "No fue posible cargar un paquete importado por el código.\n" +
        (pkgErr?.message || String(pkgErr))
      );
    }

    py.globals.set("__user_code__",codigoActual);
    py.globals.set("__user_inputs_json__",JSON.stringify(entradasUsuario));

    const wrapper = `
import io
import sys
import json
import builtins
import traceback

class _NeedInput(Exception):
    def __init__(self, prompt):
        self.prompt = prompt
        super().__init__(prompt)

_user_code = __user_code__
_inputs = json.loads(__user_inputs_json__)
_pos = 0

_stdout = io.StringIO()
_stderr = io.StringIO()

_old_stdout = sys.stdout
_old_stderr = sys.stderr
_old_input = builtins.input

def _interactive_input(prompt=""):
    global _pos

    if _pos >= len(_inputs):
        raise _NeedInput(str(prompt))

    value = _inputs[_pos]
    _pos += 1

    print(str(prompt), end="")
    print(value)

    return value

sys.stdout = _stdout
sys.stderr = _stderr
builtins.input = _interactive_input

_status = "ok"
_payload = ""

try:
    exec(
        compile(_user_code, "<codigo_estudiante>", "exec"),
        {"__name__": "__main__"}
    )

except _NeedInput as e:
    _status = "input"
    _payload = e.prompt

except BaseException:
    _status = "error"
    _payload = traceback.format_exc()

finally:
    sys.stdout = _old_stdout
    sys.stderr = _old_stderr
    builtins.input = _old_input

(_status, _stdout.getvalue(), _stderr.getvalue(), _payload)
`;

    const proxy = await py.runPythonAsync(wrapper);
    const r = proxy.toJs();
    if(proxy.destroy) proxy.destroy();

    const status = String(r[0]);
    const stdout = String(r[1] || "");
    const stderr = String(r[2] || "");
    const payload = String(r[3] || "");

    if(status === "input"){
      let texto = stdout;
      if(stderr.trim()) texto += "\n" + stderr;

      setConsole(texto,"console-info");
      mostrarInput(payload);
      setEstadoMotor("⌨️ Python: esperando entrada", "input");
      btnEjecutar.disabled = true;
      return;
    }

    if(status === "error"){
      let texto = "❌ EL CÓDIGO PRESENTÓ ERRORES\n\n";

      if(stdout.trim()){
        texto += "SALIDA ANTES DEL ERROR:\n" + stdout + "\n";
      }
      if(stderr.trim()){
        texto += "\nSALIDA DE ERROR:\n" + stderr + "\n";
      }

      texto += "\nDETALLE DEL ERROR:\n" + payload;

      setConsole(texto,"console-error");
      prepararNavegacionError(payload);

      setEstadoMotor("❌ Python: error", "error");
      btnEjecutar.disabled = false;
      sesionActiva = false;
      ocultarInsignia();
      return;
    }

    let texto = "✅ CÓDIGO EJECUTADO CORRECTAMENTE\n\n";

    if(stdout.trim()){
      texto += stdout;
    }else{
      texto += "El programa terminó correctamente y no produjo salida.\n";
    }

    if(stderr.trim()){
      texto += "\nMENSAJES ADICIONALES:\n" + stderr;
    }

    setConsole(texto,"console-ok");
    setEstadoMotor("✅ Motor Python: listo", "ready");
    btnEjecutar.disabled = false;
    sesionActiva = false;
    lineaErrorActual = null;
    btnIrLinea.style.display = "none";
    btnExplicarError.style.display = "none";
    actualizarNumerosLinea();
    mostrarInsignia();

  }catch(error){
    sesionActiva = false;
    btnEjecutar.disabled = false;
    ocultarInput();
    ocultarInsignia();
    setEstadoMotor("❌ Motor Python: error", "error");

    setConsole(
      "❌ NO FUE POSIBLE EJECUTAR PYTHON\n\n" +
      (error?.message || String(error)),
      "console-error"
    );
  }
}

async function enviarEntrada(){
  if(!esperandoEntrada) return;
  const valor = terminalInput.value;
  terminalInput.disabled = true;
  ocultarInput();
  entradasUsuario.push(valor);
  await ejecutarSesion(true);
}

terminalInput.addEventListener("keydown",async(e)=>{
  if(e.key === "Enter"){
    e.preventDefault();
    await enviarEntrada();
  }
});

btnEjecutar.addEventListener("click",async()=>{
  await ejecutarSesion(false);
});

$("btnReiniciar").addEventListener("click",()=>{
  entradasUsuario = [];
  codigoActual = "";
  sesionActiva = false;
  lineaErrorActual = null;
  ocultarInput();
  ocultarInsignia();
  btnIrLinea.style.display = "none";
  btnExplicarError.style.display = "none";
  btnEjecutar.disabled = false;
  if(pyodide){
    setEstadoMotor("✅ Motor Python: listo", "ready");
  } else {
    setEstadoMotor("⏳ Motor Python: sin iniciar", "idle");
  }
  setConsole("Sesión reiniciada. Presiona ▶ Ejecutar para comenzar.","console-info");
  actualizarNumerosLinea();
});

$("btnEjemplo").addEventListener("click",()=>{
  codigo.value =
`print("Promedio de tres notas")

nota1 = float(input("Ingrese la nota 1: "))
nota2 = float(input("Ingrese la nota 2: "))
nota3 = float(input("Ingrese la nota 3: "))

promedio = (nota1 + nota2 + nota3) / 3

print("Promedio:", round(promedio, 2))

if promedio >= 3:
    print("Resultado: Aprobado")
else:
    print("Resultado: No aprobado")`;
  lineaErrorActual = null;
  caracteresTipeados = codigo.value.length;
  caracteresPegados = 0;
  ultimoLargoCodigo = codigo.value.length;
  actualizarNumerosLinea();
  actualizarEstadisticasTipeo();
});

$("btnLimpiar").addEventListener("click",()=>{
  codigo.value = "";
  entradasUsuario = [];
  codigoActual = "";
  lineaErrorActual = null;
  caracteresTipeados = 0;
  caracteresPegados = 0;
  ultimoLargoCodigo = 0;
  ocultarInput();
  ocultarInsignia();
  btnIrLinea.style.display = "none";
  btnExplicarError.style.display = "none";
  btnEjecutar.disabled = false;
  setConsole("Editor limpio. Escribe un programa y presiona ▶ Ejecutar.","console-info");
  actualizarNumerosLinea();
  actualizarEstadisticasTipeo();
});

$("btnDescargar").addEventListener("click",()=>{
  if(!ultimoSVG) return;

  const blob = new Blob([ultimoSVG],{
    type:"image/svg+xml;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const docSeguro = cc.value.trim().replace(/[^0-9A-Za-z_-]/g,"_");

  a.href = url;
  a.download = `insignia_python_${docSeguro || "estudiante"}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(()=>URL.revokeObjectURL(url),1000);
});

codigo.addEventListener("keydown",(e)=>{
  if(e.key === "Tab"){
    e.preventDefault();
    const start = codigo.selectionStart;
    const end = codigo.selectionEnd;

    codigo.value =
      codigo.value.substring(0,start) +
      "    " +
      codigo.value.substring(end);

    codigo.selectionStart = codigo.selectionEnd = start + 4;
    actualizarNumerosLinea();
  }
});

window.addEventListener("load",()=>{
  actualizarNumerosLinea();
  if(codigo){
    ultimoLargoCodigo = codigo.value.length;
    caracteresTipeados = codigo.value.length;
    actualizarEstadisticasTipeo();
  }

  setTimeout(()=>{
    if(typeof loadPyodide !== "function"){
      setEstadoMotor("⚠️ Pyodide no disponible", "error");
      setConsole(
        "⚠️ Chrome abrió la aplicación, pero no pudo descargar Pyodide.\n\n" +
        "Compruebe la conexión a Internet o posibles bloqueos de red.",
        "console-error"
      );
    }
  },1200);
});
