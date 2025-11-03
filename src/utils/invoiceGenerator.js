// src/utils/invoiceGenerator.js

import { jsPDF } from './pdfSetup'; // Import jsPDF già configurato con autotable
import logo from '../assets/logo.png';

/**
 * Genera un PDF di fattura per una prenotazione
 * @param {Object} reservation - Dati della prenotazione
 * @param {string} invoiceNumber - Numero progressivo fattura (es. "INV-2024-001")
 * @returns {jsPDF} - Documento PDF generato
 */
export const generateInvoicePDF = (reservation, invoiceNumber) => {
  const docPdf = new jsPDF();

  // Logo
  try {
    docPdf.addImage(logo, 'PNG', 10, 10, 50, 20);
  } catch (error) {
    console.error("Errore nell'aggiungere il logo al PDF:", error);
  }

  // Numero Fattura
  docPdf.setFontSize(10);
  docPdf.text(`Fattura N. ${invoiceNumber}`, 200, 15, null, null, 'right');
  docPdf.text(`Data: ${new Date().toLocaleDateString('it-IT')}`, 200, 20, null, null, 'right');

  // Titolo
  docPdf.setFontSize(18);
  docPdf.text('Fattura di Checkout', 105, 40, null, null, 'center');

  // Tabella Dati Ospite
  docPdf.autoTable({
    startY: 50,
    head: [['Nome Ospite', 'Numero Telefono']],
    body: [
      [reservation.guestName || 'N/A', reservation.phoneNumber || 'N/A'],
    ],
    theme: 'plain',
    styles: { fontSize: 12 },
    headStyles: { fillColor: [240, 240, 240] },
  });

  // Calcolo del Numero di Notti
  const checkInDate = reservation.checkInDate?.toDate ? reservation.checkInDate.toDate() : new Date(reservation.checkInDate);
  const checkOutDate = reservation.checkOutDate?.toDate ? reservation.checkOutDate.toDate() : new Date(reservation.checkOutDate);
  let numberOfNights = 0;
  if (checkInDate && checkOutDate) {
    const diffTime = checkOutDate - checkInDate;
    numberOfNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (numberOfNights <= 0) numberOfNights = 1;
  }

  // Dettagli Stanza e Date
  const rooms = Array.isArray(reservation.roomNumbers)
    ? reservation.roomNumbers.join(', ')
    : reservation.roomNumber || 'N/A';

  docPdf.autoTable({
    startY: docPdf.lastAutoTable.finalY + 5,
    head: [['Numero Stanza', 'Check-in', 'Check-out', 'Numero Notti']],
    body: [
      [
        rooms,
        checkInDate ? checkInDate.toLocaleDateString('it-IT') : 'N/A',
        checkOutDate ? checkOutDate.toLocaleDateString('it-IT') : 'N/A',
        numberOfNights,
      ],
    ],
    theme: 'plain',
    styles: { fontSize: 12 },
    headStyles: { fillColor: [240, 240, 240] },
  });

  // Calcolo Extras Totali
  let totalExtras = 0;
  if (reservation.extraPerRoom && Array.isArray(reservation.roomNumbers)) {
    reservation.roomNumbers.forEach((room) => {
      const extras = reservation.extraPerRoom[room] || {};
      totalExtras += Number(extras.extraBar || 0) + Number(extras.extraServizi || 0);
      if (extras.petAllowed) totalExtras += 10;
      if (reservation.roomCribs && reservation.roomCribs[room]) {
        totalExtras += 10;
      }
    });
  } else if (reservation.extraPerRoom) {
    // Prenotazione singola
    const extras = reservation.extraPerRoom;
    totalExtras += Number(extras.extraBar || 0) + Number(extras.extraServizi || 0);
    if (extras.petAllowed) totalExtras += 10;
    if (reservation.roomCribs) totalExtras += 10;
  }

  const deposit = Number(reservation.deposit || 0);
  const price = Number(reservation.price || 0);
  const totalToPay = (price + totalExtras - deposit).toFixed(2);

  // Tabella Prezzi Totali
  docPdf.autoTable({
    startY: docPdf.lastAutoTable.finalY + 5,
    head: [['Descrizione', 'Importo (€)']],
    body: [
      ['Prezzo Totale', price.toFixed(2)],
      ['Extras Totali', totalExtras.toFixed(2)],
      ['Caparra Versata', `-€ ${deposit.toFixed(2)}`],
      ['Totale da Pagare', `€ ${totalToPay}`],
    ],
    theme: 'striped',
    styles: { fillColor: [245, 245, 245], fontSize: 12 },
    headStyles: { fillColor: [220, 220, 220] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right' },
    },
  });

  // Suddivisione Prezzi per Camera
  if (reservation.roomPrices && Array.isArray(reservation.roomNumbers)) {
    docPdf.autoTable({
      startY: docPdf.lastAutoTable.finalY + 10,
      head: [['Camera', 'Prezzo per Notte (€)']],
      body: reservation.roomNumbers.map((room) => [
        `Stanza ${room}`,
        `€ ${Number(reservation.roomPrices[room] || 0).toFixed(2)}`,
      ]),
      theme: 'striped',
      styles: { fillColor: [245, 245, 245], fontSize: 12 },
      headStyles: { fillColor: [220, 220, 220] },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'right' },
      },
    });
  }

  // Extras per Camera
  if (reservation.extraPerRoom && Array.isArray(reservation.roomNumbers)) {
    reservation.roomNumbers.forEach((room) => {
      const extras = reservation.extraPerRoom[room] || {};
      const extrasData = [
        [`Stanza ${room} - Extra Pet`, extras.petAllowed ? 'Sì (+10€)' : 'No'],
        [`Stanza ${room} - Extra Bar`, `€ ${Number(extras.extraBar || 0).toFixed(2)}`],
        [`Stanza ${room} - Extra Servizi`, `€ ${Number(extras.extraServizi || 0).toFixed(2)}`],
      ];

      if (reservation.roomCribs && reservation.roomCribs[room]) {
        extrasData.push([`Stanza ${room} - Culla`, '€ 10.00']);
      }

      docPdf.autoTable({
        startY: docPdf.lastAutoTable.finalY + 5,
        head: [['Descrizione', 'Dettaglio']],
        body: extrasData,
        theme: 'striped',
        styles: { fillColor: [245, 245, 245], fontSize: 12 },
        headStyles: { fillColor: [220, 220, 220] },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { halign: 'right' },
        },
        margin: { left: 15 },
      });
    });
  }

  // Numero Totale di Persone
  docPdf.autoTable({
    startY: docPdf.lastAutoTable.finalY + 10,
    head: [['Numero Totale di Persone']],
    body: [[reservation.totalPeople || 'N/A']],
    theme: 'plain',
    styles: { fontSize: 12 },
    headStyles: { fillColor: [240, 240, 240] },
    columnStyles: {
      0: { cellWidth: 'auto' },
    },
  });

  // Footer
  docPdf.setFontSize(12);
  docPdf.text(
    'Grazie per aver scelto il nostro hotel!',
    105,
    docPdf.lastAutoTable.finalY + 15,
    null,
    null,
    'center'
  );

  return docPdf;
};

/**
 * Genera e scarica immediatamente il PDF
 * @param {Object} reservation - Dati della prenotazione
 * @param {string} invoiceNumber - Numero progressivo fattura
 */
export const downloadInvoicePDF = (reservation, invoiceNumber) => {
  const docPdf = generateInvoicePDF(reservation, invoiceNumber);
  const fileName = `Fattura_${invoiceNumber}_${reservation.guestName || 'Guest'}.pdf`;
  
  try {
    docPdf.save(fileName);
    console.log('PDF generato e salvato:', fileName);
  } catch (error) {
    console.error('Errore nel salvataggio del PDF:', error);
    throw error;
  }
};

/**
 * Genera numero fattura progressivo
 * @param {number} count - Numero progressivo
 * @returns {string} - Numero fattura formattato (es. "INV-2024-001")
 */
export const generateInvoiceNumber = (count) => {
  const year = new Date().getFullYear();
  const paddedCount = String(count).padStart(4, '0');
  return `INV-${year}-${paddedCount}`;
};
