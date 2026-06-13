/* CASADUCHO — configuración de "Ordenar en mesa" (TOI / SnowEats).
   Llena menuUrl con la URL del MENÚ DIGITAL de SnowEats cuando Miguel la pase.
   - Si SnowEats acepta un parámetro por mesa en la URL, ponlo en tableParam (ej. "mesa", "table", "t").
   - Si SnowEats genera una URL distinta por mesa (token propio), deja menuUrl vacío y usa
     perTableUrls = { "1": "https://...", "2": "https://..." } (los QR pueden apuntar directo ahí).
   Mientras menuUrl esté vacío, la página /mesa muestra los menús del sitio + llamar al mesero. */
window.CASADUCHO_TOI = {
  menuUrl: "",                 // <-- URL del menú digital SnowEats (pedir/pagar). Ej: "https://app.snoweats.com/menu/casaducho"
  tableParam: "mesa",          // nombre del parámetro de mesa que espera SnowEats en la URL
  perTableUrls: {},            // opcional: { "5": "https://app.snoweats.com/..." } si cada mesa tiene URL propia
  whatsappWaiter: "18495915955", // PideBot — para "llamar al mesero"
  reserveUrl: "",              // <-- URL de RESERVAS de TOI (el viewfinder manda aquí desde "Reservar en TOI"). Mientras vacío, cae a WhatsApp.
  brand: "Casaducho"
};
