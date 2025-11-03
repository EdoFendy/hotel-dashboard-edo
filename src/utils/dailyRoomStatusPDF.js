// src/utils/dailyRoomStatusPDF.js
// Genera PDF con stato camere giornaliero per personale pulizie/gestione

import { jsPDF } from './pdfSetup';
import logo from '../assets/logo.png';

const ROOM_TYPES = {
  1: 'Quadrupla', 2: 'Tripla', 3: 'Doppia + Bagno Handicap', 4: 'Matrimoniale',
  5: 'Singola', 6: 'Matrimoniale/Doppia', 7: 'Tripla', 8: 'Matrimoniale',
  9: 'Matrimoniale/Doppia', 10: 'Tripla', 11: 'Quadrupla', 12: 'Matrimoniale',
  13: 'Matrimoniale', 14: 'Matrimoniale/Doppia', 15: 'Tripla', 16: 'Matrimoniale',
};

/**
 * Genera PDF report giornaliero stato camere
 * @param {Object} data - Dati del report
 * @param {Array} data.staying - Camere con ospiti che fermano (restano)
 * @param {Array} data.checkingOut - Camere con ospiti in partenza (checkout oggi)
 * @param {Array} data.checkingIn - Camere con nuovi arrivi oggi
 * @param {Array} data.available - Camere disponibili
 * @param {Date} data.date - Data del report
 */
export const generateDailyRoomStatusPDF = (data) => {
  const doc = new jsPDF();
  const { staying = [], checkingOut = [], checkingIn = [], available = [], date = new Date() } = data;
  
  const dateStr = date.toLocaleDateString('it-IT', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Logo
  try {
    doc.addImage(logo, 'PNG', 10, 10, 40, 16);
  } catch (error) {
    console.error('Errore logo:', error);
  }

  // Intestazione
  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.text('REPORT STATO CAMERE', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont(undefined, 'normal');
  doc.text(dateStr.toUpperCase(), 105, 28, { align: 'center' });

  let yPos = 40;

  // Riepilogo numerico
  doc.setFontSize(10);
  doc.setFillColor(240, 240, 240);
  doc.rect(10, yPos, 190, 20, 'F');
  
  doc.setFont(undefined, 'bold');
  doc.text(`📊 RIEPILOGO GIORNALIERO`, 15, yPos + 6);
  doc.setFont(undefined, 'normal');
  doc.text(`Camere Occupate: ${staying.length + checkingOut.length}`, 15, yPos + 12);
  doc.text(`In Partenza: ${checkingOut.length}`, 70, yPos + 12);
  doc.text(`Arrivi Oggi: ${checkingIn.length}`, 115, yPos + 12);
  doc.text(`Disponibili: ${available.length}`, 160, yPos + 12);
  
  yPos += 28;

  // SEZIONE 1: CAMERE FERMATA (Ospiti che restano)
  if (staying.length > 0) {
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setFillColor(255, 243, 205); // Giallo chiaro
    doc.rect(10, yPos, 190, 8, 'F');
    doc.text('🏨 CAMERE FERMATA - Ospiti che Restano', 15, yPos + 6);
    yPos += 12;

    staying.forEach((room, index) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text(`Camera ${room.roomNumber} - ${ROOM_TYPES[room.roomNumber] || 'Standard'}`, 15, yPos);
      
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      yPos += 5;
      
      doc.text(`Ospite: ${room.guestName}`, 20, yPos);
      yPos += 4;
      doc.text(`Check-out: ${room.checkOutDate}`, 20, yPos);
      yPos += 4;
      doc.text(`Persone: ${room.totalPeople || 'N/D'}`, 20, yPos);
      yPos += 4;

      // Note
      if (room.additionalNotes) {
        doc.setFont(undefined, 'italic');
        doc.text(`📝 Note: ${room.additionalNotes.substring(0, 80)}`, 20, yPos);
        yPos += 4;
      }

      // Spazio per note scritte a mano
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.rect(20, yPos, 170, 10);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('Note pulizie:', 22, yPos + 3);
      doc.setTextColor(0, 0, 0);
      
      yPos += 14;
      
      // Linea separatrice
      if (index < staying.length - 1) {
        doc.setDrawColor(220, 220, 220);
        doc.line(10, yPos, 200, yPos);
        yPos += 4;
      }
    });
    
    yPos += 6;
  }

  // SEZIONE 2: CAMERE IN PARTENZA (Checkout oggi)
  if (checkingOut.length > 0) {
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setFillColor(255, 220, 220); // Rosso chiaro
    doc.rect(10, yPos, 190, 8, 'F');
    doc.text('🚪 IN PARTENZA - Checkout Oggi', 15, yPos + 6);
    yPos += 12;

    checkingOut.forEach((room, index) => {
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text(`Camera ${room.roomNumber} - ${ROOM_TYPES[room.roomNumber] || 'Standard'}`, 15, yPos);
      
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      yPos += 5;
      
      doc.text(`Ospite: ${room.guestName}`, 20, yPos);
      yPos += 4;
      doc.text(`Persone: ${room.totalPeople || 'N/D'}`, 20, yPos);
      yPos += 4;

      // Servizi extra
      if (room.extras && room.extras.length > 0) {
        doc.setFont(undefined, 'bold');
        doc.text(`Servizi Extra:`, 20, yPos);
        doc.setFont(undefined, 'normal');
        yPos += 4;
        room.extras.forEach(extra => {
          doc.text(`  • ${extra}`, 25, yPos);
          yPos += 3.5;
        });
      }

      // Note
      if (room.additionalNotes) {
        doc.setFont(undefined, 'italic');
        doc.text(`📝 Note: ${room.additionalNotes.substring(0, 80)}`, 20, yPos);
        yPos += 4;
      }

      // Spazio per note scritte a mano
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.rect(20, yPos, 170, 12);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('Note pulizie/servizi:', 22, yPos + 3);
      doc.setTextColor(0, 0, 0);
      
      yPos += 16;
      
      // Linea separatrice
      if (index < checkingOut.length - 1) {
        doc.setDrawColor(220, 220, 220);
        doc.line(10, yPos, 200, yPos);
        yPos += 4;
      }
    });
    
    yPos += 6;
  }

  // SEZIONE 3: NUOVI ARRIVI (Check-in oggi)
  if (checkingIn.length > 0) {
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setFillColor(220, 255, 220); // Verde chiaro
    doc.rect(10, yPos, 190, 8, 'F');
    doc.text('✨ NUOVI ARRIVI - Check-in Oggi', 15, yPos + 6);
    yPos += 12;

    checkingIn.forEach((room, index) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text(`Camera ${room.roomNumber} - ${ROOM_TYPES[room.roomNumber] || 'Standard'}`, 15, yPos);
      
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      yPos += 5;
      
      doc.text(`Ospite: ${room.guestName} | Persone: ${room.totalPeople || 'N/D'}`, 20, yPos);
      yPos += 8;
    });
  }

  // SEZIONE 4: CAMERE DISPONIBILI
  if (available.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setFillColor(240, 255, 240);
    doc.rect(10, yPos, 190, 6, 'F');
    doc.text(`✓ Camere Disponibili (${available.length})`, 15, yPos + 4.5);
    yPos += 10;

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    const availableStr = available.map(r => `#${r}`).join(', ');
    const lines = doc.splitTextToSize(availableStr, 180);
    lines.forEach(line => {
      doc.text(line, 15, yPos);
      yPos += 4;
    });
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(
      `Generato il ${new Date().toLocaleString('it-IT')} - Pagina ${i} di ${pageCount}`,
      105,
      290,
      { align: 'center' }
    );
  }

  return doc;
};

/**
 * Scarica il PDF del report giornaliero
 */
export const downloadDailyRoomStatusPDF = (data) => {
  const doc = generateDailyRoomStatusPDF(data);
  const dateStr = (data.date || new Date()).toLocaleDateString('it-IT').replace(/\//g, '-');
  doc.save(`Report_Camere_${dateStr}.pdf`);
};
