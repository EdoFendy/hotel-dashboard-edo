// src/components/DailyRoomStatusButton.jsx
// Bottone per generare report giornaliero camere

import React, { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { downloadDailyRoomStatusPDF } from '../utils/dailyRoomStatusPDF';

function DailyRoomStatusButton({ className = '', style = {} }) {
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Query tutte le prenotazioni attive
      const reservationsRef = collection(db, 'reservations');
      const snapshot = await getDocs(reservationsRef);
      
      const staying = [];
      const checkingOut = [];
      const checkingIn = [];
      const occupiedRooms = new Set();

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const checkIn = data.checkInDate?.toDate();
        const checkOut = data.checkOutDate?.toDate();
        
        if (!checkIn || !checkOut) return;
        
        checkIn.setHours(0, 0, 0, 0);
        checkOut.setHours(0, 0, 0, 0);

        // Camere della prenotazione
        const rooms = Array.isArray(data.roomNumbers) 
          ? data.roomNumbers 
          : [data.roomNumber].filter(Boolean);

        rooms.forEach(roomNum => {
          occupiedRooms.add(roomNum);

          // Prepara dati camera
          const roomData = {
            roomNumber: roomNum,
            guestName: data.guestName || 'N/D',
            totalPeople: data.totalPeople || 0,
            checkOutDate: checkOut.toLocaleDateString('it-IT'),
            additionalNotes: data.additionalNotes || '',
            extras: [],
          };

          // Raccogli extras
          if (data.extraPerRoom && data.extraPerRoom[roomNum]) {
            const extras = data.extraPerRoom[roomNum];
            if (extras.petAllowed) roomData.extras.push('🐕 Pet');
            if (extras.extraBar > 0) roomData.extras.push(`🍹 Bar: €${extras.extraBar}`);
            if (extras.extraServizi > 0) roomData.extras.push(`🔧 Servizi: €${extras.extraServizi}`);
          }
          if (data.roomCribs && data.roomCribs[roomNum]) {
            roomData.extras.push('👶 Culla');
          }

          // Categorizza camera
          if (checkIn < today && checkOut.getTime() === today.getTime()) {
            // Checkout oggi
            checkingOut.push(roomData);
          } else if (checkIn.getTime() === today.getTime()) {
            // Check-in oggi
            checkingIn.push(roomData);
          } else if (checkIn < today && checkOut > today) {
            // Fermata (resta)
            staying.push(roomData);
          }
        });
      });

      // Camere disponibili (non occupate)
      const allRooms = Array.from({ length: 16 }, (_, i) => i + 1);
      const available = allRooms.filter(room => !occupiedRooms.has(room));

      // Ordina per numero camera
      const sortByRoom = (a, b) => a.roomNumber - b.roomNumber;
      staying.sort(sortByRoom);
      checkingOut.sort(sortByRoom);
      checkingIn.sort(sortByRoom);

      // Genera PDF
      downloadDailyRoomStatusPDF({
        staying,
        checkingOut,
        checkingIn,
        available,
        date: today,
      });

      console.log('Report generato:', { staying: staying.length, checkingOut: checkingOut.length, checkingIn: checkingIn.length, available: available.length });
      
    } catch (error) {
      console.error('Errore generazione report:', error);
      alert('Errore nella generazione del report. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={generateReport}
      disabled={loading}
      className={className}
      style={{
        padding: '0.75rem 1.25rem',
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        color: 'white',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        fontSize: '0.95rem',
        fontWeight: '600',
        cursor: loading ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        transition: 'all 0.2s ease',
        opacity: loading ? 0.6 : 1,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!loading) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 8px 16px rgba(16, 185, 129, 0.3)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {loading ? (
        <>
          <span className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
          Generazione...
        </>
      ) : (
        <>
          <span>📄</span>
          <span>Report Camere Oggi</span>
        </>
      )}
    </button>
  );
}

export default DailyRoomStatusButton;
