import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import {
  doc,
  getDoc,
  updateDoc,
  Timestamp,
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import Layout from '../components/Layout';
import '../styles/AddExpense.css';

/**
 * Componente per modificare una spesa esistente
 */
function EditExpense() {
  const { id } = useParams();           // recuperiamo l'ID dalla rotta
  const navigate = useNavigate();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('');
  const [reservationId, setReservationId] = useState('');
  const [error, setError] = useState('');
  const [concludedReservations, setConcludedReservations] = useState([]);

  useEffect(() => {
    // 1) Recuperiamo le prenotazioni concluse (come nel tuo AddExpense) 
    const reservationsQuery = query(
      collection(db, 'reservations'),
      where('status', '==', 'conclusa')
    );

    const unsubscribe = onSnapshot(reservationsQuery, (snapshot) => {
      const resData = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setConcludedReservations(resData);
    });

    // 2) Carichiamo i dati della spesa da modificare
    const fetchExpense = async () => {
      try {
        const docRef = doc(db, 'expenses', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const expenseData = docSnap.data();
          setDescription(expenseData.description || '');
          setAmount(expenseData.amount?.toString() || '');
          setCategory(expenseData.category || '');
          setReservationId(expenseData.reservationId || '');

          // Se la data esiste, convertiamola in formato "yyyy-MM-dd" per l'input date
          if (expenseData.date) {
            const dateObj = expenseData.date.toDate();
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            setDate(`${year}-${month}-${day}`);
          }
        } else {
          console.log('La spesa non esiste');
          navigate('/expenses'); // se il doc non esiste, torniamo alla lista
        }
      } catch (err) {
        console.error('Errore durante il recupero della spesa:', err);
      }
    };

    fetchExpense();

    // Cleanup listener su Firestore
    return () => unsubscribe();
  }, [id, navigate]);

  /**
   * Gestisce la sottomissione del modulo per modificare la spesa
   * @param {object} e
   */
  const handleUpdateExpense = async (e) => {
    e.preventDefault();

    // Validazione semplice
    if (!description || !amount || !date || !category) {
      setError('Per favore, compila tutti i campi.');
      return;
    }

    try {
      const docRef = doc(db, 'expenses', id);

      await updateDoc(docRef, {
        description,
        amount: parseFloat(amount),
        date: Timestamp.fromDate(new Date(date)),
        category,
        reservationId,
      });

      navigate('/expenses');
    } catch (err) {
      console.error('Errore durante l\'aggiornamento della spesa:', err);
      setError('Errore durante l\'aggiornamento della spesa');
    }
  };

  return (
    <Layout>
      <div className="add-expense">
        <h2>Modifica Spesa</h2>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleUpdateExpense}>
          <label>Descrizione:</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />

          <label>Importo (€):</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />

          <label>Data:</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />

          <label>Categoria:</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          >
            <option value="">Seleziona una categoria</option>
            <option value="Pulizie">Pulizie</option>
            <option value="Manutenzione">Manutenzione</option>
            <option value="Utenze">Utenze</option>
            <option value="Personale">Personale</option>
            <option value="Marketing">Marketing</option>
            <option value="Altro">Altro</option>
          </select>

          {/* Se desideri permettere il cambio della reservationId */}
          <label>Prenotazione Conclusa:</label>
          <select
            value={reservationId}
            onChange={(e) => setReservationId(e.target.value)}
          >
            <option value="">Nessuna</option>
            {concludedReservations.map((res) => (
              <option key={res.id} value={res.id}>
                {res.id} - {res.name ? res.name : 'Senza nome'}
              </option>
            ))}
          </select>

          <button type="submit">Aggiorna Spesa</button>
        </form>
      </div>
    </Layout>
  );
}

export default EditExpense;
