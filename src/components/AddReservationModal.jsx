// src/components/AddReservationModal.jsx
import React, { useState } from 'react';
import { db } from '../firebase';
import './AddReservationModal.css';

const AddReservationModal = ({ isOpen, onClose }) => {
  const [guestName, setGuestName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [roomType, setRoomType] = useState('standard');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [status, setStatus] = useState('confermata');

  const handleSubmit = async e => {
    e.preventDefault();

    try {
      // Controllo disponibilità
      const conflictingReservations = await db
        .collection('reservations')
        .where('roomNumber', '==', roomNumber)
        .where('checkInDate', '<', new Date(checkOutDate))
        .where('checkOutDate', '>', new Date(checkInDate))
        .get();

      if (!conflictingReservations.empty) {
        alert('La camera non è disponibile nelle date selezionate.');
        return;
      }

      await db.collection('reservations').add({
        guestName,
        roomNumber,
        roomType,
        checkInDate: new Date(checkInDate),
        checkOutDate: new Date(checkOutDate),
        status,
      });

      onClose();
    } catch (error) {
      console.error('Errore:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Aggiungi Prenotazione</h2>
        <form onSubmit={handleSubmit}>
          <label>Nome Cliente:</label>
          <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)} required />

          <label>Numero Camera:</label>
          <input type="text" value={roomNumber} onChange={e => setRoomNumber(e.target.value)} required />

          <label>Tipologia Camera:</label>
          <select value={roomType} onChange={e => setRoomType(e.target.value)}>
            <option value="standard">Standard</option>
            <option value="deluxe">Deluxe</option>
            <option value="suite">Suite</option>
          </select>

          <label>Data Check-in:</label>
          <input type="date" value={checkInDate} onChange={e => setCheckInDate(e.target.value)} required />

          <label>Data Check-out:</label>
          <input type="date" value={checkOutDate} onChange={e => setCheckOutDate(e.target.value)} required />

          <label>Stato:</label>
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="confermata">Confermata</option>
            <option value="in attesa">In Attesa</option>
            <option value="cancellata">Cancellata</option>
          </select>

          <button type="submit">Aggiungi</button>
          <button type="button" onClick={onClose}>
            Annulla
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddReservationModal;
