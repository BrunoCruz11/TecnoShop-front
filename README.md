# TecnoShop — Front

Interfaz web de TecnoShop para gestionar productos, proveedores, compras y usuarios.

Hecha en **HTML, CSS y JavaScript puro**: no usa frameworks ni hay que instalar nada para programarla.

Necesita el back funcionando: [TecnoShop](https://github.com/BrunoCruz11/TecnoShop).

---

## 1. Qué necesitás instalar

Para el front alcanza con **Git** y **Python 3** (en Mac y Linux ya viene; se verifica con `python3 --version`).

Para el back necesitás además Java 21, Maven y Docker Desktop. Los detalles están en el [README del back](https://github.com/BrunoCruz11/TecnoShop#1-qué-necesitás-instalar).

---

## 2. Descargar el proyecto

El back y el front van **en la misma carpeta, uno al lado del otro**:

```
mkdir tecnoshop && cd tecnoshop
git clone https://github.com/BrunoCruz11/TecnoShop.git
git clone https://github.com/BrunoCruz11/TecnoShop-front.git
```

Queda así:

```
tecnoshop/
├── TecnoShop/          ← el back
└── TecnoShop-front/    ← este repo
```

---

## 3. Levantar todo en tu compu

### Paso 1: levantar la base y el back

Seguí los pasos 1 a 3 del [README del back](https://github.com/BrunoCruz11/TecnoShop#3-levantar-todo-en-tu-compu-desarrollo). En resumen, con Docker Desktop abierto:

```
cd TecnoShop
docker compose up -d
mvn compile exec:java
```

Esperá a ver `API escuchando en el puerto 8080` y **dejá esa terminal abierta**.

### Paso 2: levantar el front (en otra terminal)

```
cd TecnoShop-front
python3 -m http.server 5500
```

### Paso 3: entrar

Abrí **http://localhost:5500** e ingresá con:

- **Email:** `admin@tecnoshop.com`
- **Contraseña:** `admin1234`

El back crea ese usuario la primera vez. **No hay registro público**: los usuarios nuevos se crean desde la sección **Usuarios**, con una sesión iniciada.

### Para apagar

`Ctrl + C` en la terminal del front y en la del back.

---

## 4. Qué se puede hacer

| Sección | Qué hace |
|---|---|
| **Productos** | Alta, edición, búsqueda y marcar disponible / no disponible. Muestra una alerta con los productos que están en o por debajo del stock mínimo. |
| **Proveedores** | Alta, edición y baja. No deja borrar un proveedor que tiene compras. |
| **Compras** | Registrar una compra con varios productos, verla, confirmarla (suma el stock) o cancelarla. Se puede filtrar por usuario, proveedor o fechas. |
| **Usuarios** | Crear usuarios y activarlos o desactivarlos. Un usuario desactivado no puede entrar. |

---

## 5. Problemas comunes

| Problema | Solución |
|---|---|
| "No se pudo conectar con el servidor" | El back no está corriendo. Levantalo (paso 1). |
| `Address already in use` | Ya tenés el front corriendo en otra terminal. Cerrala con `Ctrl + C`. |
| Me saca al login con "La sesión venció" | Pasaron más de 8 horas o te desactivaron. Volvé a iniciar sesión. |
| Abrí `index.html` con doble clic y no anda | Tiene que abrirse desde `http://localhost:5500` (paso 2), no como archivo. |

---

## 6. Cómo está organizado

```
index.html                    las pantallas: login, productos, proveedores, compras, usuarios
config.js                     la dirección del back (en desarrollo: http://localhost:8080/api)
js/api.js                     todas las llamadas al back; agrega el token de sesión
js/app.js                     la lógica de cada pantalla
css/estilos.css               los estilos, con modo claro y oscuro automático
nginx/default.conf.template   configuración de nginx para producción
Dockerfile                    imagen de producción
```

Si el back corre en otra dirección, cambiala en `config.js`.

---

## 7. Producción

En producción el front se sirve con **nginx**, que hace tres cosas:
- entrega estos archivos;
- reenvía `/api` al back;
- agrega encabezados de seguridad.

**No se levanta solo**: se levanta junto con el back y la base desde el repo del back. Los pasos están en su README, en [Subirlo a un servidor](https://github.com/BrunoCruz11/TecnoShop#8-subirlo-a-un-servidor-producción).

| Variable | Qué hace | Por defecto |
|---|---|---|
| `API_UPSTREAM` | Dirección interna del back | `http://backend:8080` |
| `API_URL` | Dirección de la API que usa el navegador | `/api` |
