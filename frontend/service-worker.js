self.addEventListener("push", event => {
  console.log("📩 Push recibido en SW");

  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    console.error("❌ No se pudo parsear el JSON:", e);
  }

  console.log("📦 Payload recibido:", data);

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/icon.png"
    })
  );
});
