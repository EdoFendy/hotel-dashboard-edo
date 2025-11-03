// src/pages/AddReservation.jsx

import React from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import ReservationWizard from '../components/reservations/ReservationWizard';
import { db } from '../firebase';
import '../styles/AddReservation.css';

function AddReservation() {
  const navigate = useNavigate();

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
    navigate('/reservations');
  };

  return (
    <Layout>
      <ReservationWizard
        title="Nuova Prenotazione"
        onSubmit={handleSubmit}
        onCancel={() => navigate('/reservations')}
      />
    </Layout>
  );
}

export default AddReservation;
