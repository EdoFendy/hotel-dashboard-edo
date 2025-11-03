// src/pages/DeleteReservation.jsx

import React, { useEffect } from 'react';
import { db } from '../firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import '../styles/DeleteReservation.css';

/**
 * Componente per eliminare una prenotazione
 */
function DeleteReservation() {
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    const confirmDelete = async () => {
      const confirmAction = window.confirm('Sei sicuro di voler eliminare questa prenotazione?');
      if (confirmAction) {
        try {
          await deleteDoc(doc(db, 'reservations', id));
          navigate('/reservations');
        } catch (err) {
          console.error('Errore durante l\'eliminazione della prenotazione:', err);
          alert('Errore durante l\'eliminazione della prenotazione');
          navigate('/reservations');
        }
      } else {
        navigate('/reservations');
      }
    };

    confirmDelete();
  }, [id, navigate]);

  return (
    <Layout>
      <div className="delete-reservation">
        <h2>Eliminazione Prenotazione</h2>
        <p>Eliminazione in corso...</p>
      </div>
    </Layout>
  );
}

export default DeleteReservation;
