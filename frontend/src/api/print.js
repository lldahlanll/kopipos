import client from './client';

/**
 * Cetak struk order ke printer thermal via backend API
 * @param {number} orderId - ID order
 * @param {Object} options - override printer settings
 */
export const printOrderViaBackend = (orderId, options = {}) =>
  client.post('/print', {
    order_id: orderId,
    printer_ip:   options.printerIp   || undefined,
    printer_port: options.printerPort || undefined,
    printer_type: options.printerType || undefined,
    paper_width:  options.paperWidth  || 58,
  });

/**
 * Cetak struk TEST (tanpa order nyata) ke printer thermal
 * @param {string} printerIp - IP printer
 * @param {number} printerPort - Port printer (default 9100)
 * @param {number} paperWidth - 58 atau 80
 */
export const printTestViaBackend = (printerIp, printerPort = 9100, paperWidth = 58) =>
  client.post(`/print/test?printer_ip=${printerIp}&printer_port=${printerPort}&paper_width=${paperWidth}`);
