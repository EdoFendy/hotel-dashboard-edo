// src/components/AddReservationDrawer.jsx

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import ReservationWizard from './reservations/ReservationWizard';
import useScrollLock from '../hooks/useScrollLock';
import '../styles/common.css';

function AddReservationDrawer({ isOpen, onClose, onSuccess }) {
  const [successMessage, setSuccessMessage] = useState('');
  const drawerBodyRef = useRef(null);

  useScrollLock(isOpen);

  useEffect(() => {
    if (isOpen) {
      setSuccessMessage('');
      if (drawerBodyRef.current) {
        drawerBodyRef.current.scrollTop = 0;
      }
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    setSuccessMessage('');
    if (onClose) {
      onClose();
    }
  };

  const handleSubmit = async (payload) => {
    const reservationsRef = collection(db, 'reservations');
    const dataToSave = {
      ...payload,
      roomNumbers: payload.roomNumbers.map((room) => Number(room)),
      checkInDate: Timestamp.fromDate(payload.checkInDate),
      checkOutDate: Timestamp.fromDate(payload.checkOutDate),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await addDoc(reservationsRef, dataToSave);
  };

  const handleSuccess = (payload) => {
    setSuccessMessage('Prenotazione creata con successo.');
    if (onSuccess) {
      onSuccess(payload);
    }
    setTimeout(() => {
      handleClose();
    }, 1200);
  };

  return createPortal(
    <div className="drawer-overlay" onClick={handleClose}>
      <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h2 className="drawer-title">➕ Nuova Prenotazione</h2>
          <button className="modal-close" onClick={handleClose} aria-label="Chiudi">
            ✕
          </button>
        </div>

        <div className="drawer-body" ref={drawerBodyRef}>
          {successMessage && (
            <div className="success-message" style={{ marginBottom: '1rem' }}>
              {successMessage}
            </div>
          )}

          <ReservationWizard
            title="Nuova Prenotazione"
            context="drawer"
            onSubmit={handleSubmit}
            onCancel={handleClose}
            onSuccess={handleSuccess}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

export default AddReservationDrawer;
