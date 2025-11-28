const db = require("../db");
const webpush = require("../utils/push");

exports.guardarSuscripcion = async (req, res) => {
  try {
    const { userId, subscription } = req.body;

    if (!userId || !subscription) {
      return res.status(400).json({ error: "Faltan datos." });
    }

    const usuario = await db.query(
      "SELECT push_subscriptions FROM usuario WHERE id = $1",
      [userId]
    );

    let subs = usuario.rows[0].push_subscriptions || [];

    // evitar duplicados
    if (!subs.find(x => x.endpoint === subscription.endpoint)) {
      subs.push(subscription);
    }

    await db.query(
      "UPDATE usuario SET push_subscriptions = $1 WHERE id = $2",
      [JSON.stringify(subs), userId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error guardando suscripción" });
  }
};

exports.enviarPrueba = async (req, res) => {
  try {
    const { userId, titulo, mensaje } = req.body;

    const usuario = await db.query(
      "SELECT push_subscriptions FROM usuario WHERE id = $1",
      [userId]
    );

    const subs = usuario.rows[0].push_subscriptions || [];

    if (subs.length === 0) {
      return res.json({ ok: false, msg: "No hay suscripciones." });
    }

    const payload = {
      title: titulo || "📢 Notificación",
      body: mensaje || "Mensaje desde el frontend",
      icon: "/icon.png"
    };

    for (const sub of subs) {
      webpush.sendNotification(sub, JSON.stringify(payload));
    }

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error enviando notificación" });
  }
};
