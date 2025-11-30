<<<<<<< HEAD
﻿# Monitoreo Infantil SIG

Monitorea en tiempo real si un niño permanece dentro del área segura definida por su madre. Si sale del polígono dibujado por ella, la interfaz muestra una alerta visual inmediata.

## Requisitos previos
- Node.js 18+
- PostgreSQL 14+ con la extensión PostGIS
- Cliente `psql` o pgAdmin
- Navegador moderno

## 1. Base de datos
```bash
psql -U postgres -f database/schema.sql
```
El script crea usuarios de prueba (`madre@gmail.com` / `madre`, `nino@gmail.com` / `nino`), las tablas (`usuario`, `unidad_educativa`, `nino`, `area_segura`, `posicion_nino`) y la función `registrar_posicion` que clasifica cada punto como dentro/fuera según el polígono de la madre.

## 2. Backend (Node + Express)
```bash
cd backend
cp .env.example .env
npm install
npm start
```
Configura en `.env` las credenciales de PostgreSQL (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PORT`).

## 3. Frontend (Leaflet)
Sirve la carpeta `frontend/` con Live Server o:
```bash
cd frontend
npx serve -l 3000 .
```
Abre la URL indicada (ej. `http://localhost:3000`).

### Flujo sugerido
1. La madre inicia sesión (`madre@gmail.com` / `madre`), dibuja el polígono sobre el mapa y presiona **Guardar área**.
2. El niño inicia sesión (`nino@gmail.com` / `nino`) y pulsa “Simular nueva posición” para reportar su ubicación actual.
3. El backend clasifica la posición con PostGIS; si el niño sale del área dibujada por la madre, el panel se pone en rojo con el mensaje de alerta.

## Rutas destacadas
- `POST /api/auth/login`
- `GET|POST /api/unidades`, `GET /api/unidades/:id/geom`
- `POST /api/ninos`, `PUT /api/ninos/:id/unidad`, `GET /api/ninos/:id`
- `GET /api/ninos/:id/area`, `POST /api/ninos/:id/area`, `DELETE /api/ninos/:id/area`
- `POST /api/posiciones`, `GET /api/posiciones/ultimas/:ninoId`

Consulta los controladores en `backend/src/controllers` y el frontend en `frontend/js/main.js` para personalizar el comportamiento.
=======
# monitoreo-infantil-sig
>>>>>>> 37fad5a0679f537ea5d9ea5461526e7a116c9e61
