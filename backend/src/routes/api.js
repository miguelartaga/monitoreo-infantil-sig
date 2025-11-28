const express = require('express');
const unidadesController = require('../controllers/unidadesController');
const ninosController = require('../controllers/ninosController');
const posicionesController = require('../controllers/posicionesController');
const authController = require('../controllers/authController');
const areasController = require('../controllers/areasController');
const notificacionesController = require("../controllers/notificacionesController");


const router = express.Router();

router.post('/auth/login', authController.login);

router.post("/suscripcion-push", notificacionesController.guardarSuscripcion);
router.post("/notificacion-prueba", notificacionesController.enviarPrueba);

router.get('/unidades', unidadesController.listarUnidades);
router.post('/unidades', unidadesController.crearUnidad);
router.get('/unidades/:id/geom', unidadesController.obtenerUnidadGeom);

router.post('/ninos', ninosController.crearNino);
router.get('/ninos/:id', ninosController.obtenerNino);
router.put('/ninos/:id/unidad', ninosController.asignarUnidad);

router.get('/ninos/:id/area', areasController.obtenerArea);
router.post('/ninos/:id/area', areasController.guardarArea);
router.delete('/ninos/:id/area', areasController.eliminarArea);

router.post('/posiciones', posicionesController.crearPosicion);
router.get('/posiciones/ultimas/:ninoId', posicionesController.obtenerUltimas);

module.exports = router;
