// src/pages/EditReservation.jsx

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import EditReservationModal from '../components/EditReservationModal';
import '../styles/EditReservation.css'; // Assicurati di avere questo file CSS

function EditReservation() {
  const { id } = useParams(); // Assicurati che la rotta includa l'ID della prenotazione, es: /edit-reservation/:id
  const navigate = useNavigate();
  const [reservation, setReservation] = useState(null);
  const [error, setError] = useState('');

  // Stato per il modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Recupera i dettagli della prenotazione da modificare
  useEffect(() => {
    const fetchReservation = async () => {
      try {
        const docRef = doc(db, 'reservations', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setReservation({ id: docSnap.id, ...docSnap.data() });
          setIsModalOpen(true); // Apri il modal automaticamente
        } else {
          console.log('Nessuna prenotazione trovata');
          navigate('/calendar');
        }
      } catch (err) {
        console.error('Errore nel recupero della prenotazione:', err);
        setError('Errore nel recupero della prenotazione');
      }
    };

    if (id) {
      fetchReservation();
    }
  }, [id, navigate]);

  // Funzione per chiudere il modal
  const closeModal = () => {
    setIsModalOpen(false);
    navigate('/calendar'); // Reindirizza dopo aver chiuso il modal
  };

  // Funzione chiamata dopo l'aggiornamento della prenotazione nel modal
  const handleReservationUpdated = () => {
    // Puoi aggiungere logica aggiuntiva se necessario
    closeModal();
  };

  if (error) {
    return (
      <Layout>
        <div className="edit-reservation">
          <h2>Modifica Prenotazione</h2>
          <p className="error">{error}</p>
        </div>
      </Layout>
    );
  }

  if (!reservation) {
    return (
      <Layout>
        <div className="edit-reservation">
          <h2>Modifica Prenotazione</h2>
          <p>Caricamento...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="edit-reservation">
        <h2>Modifica Prenotazione</h2>
        {/* Modal per modificare la prenotazione */}
        <EditReservationModal
          isOpen={isModalOpen}
          onClose={closeModal}
          reservation={reservation}
          onUpdateSuccess={handleReservationUpdated}
        />
      </div>
    </Layout>
  );
}

export default EditReservation;
