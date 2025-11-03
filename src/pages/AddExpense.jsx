// src/pages/AddExpense.jsx

import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import '../styles/AddExpense.css';

/**
 * Componente per aggiungere una nuova spesa
 */
function AddExpense() {
  const navigate = useNavigate();
  
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('');
  const [reservationId, setReservationId] = useState(''); // Nuovo stato per reservationId
  const [error, setError] = useState('');



  /**
   * Gestisce la sottomissione del modulo per aggiungere una spesa
   * @param {object} e
   */
  const handleAddExpense = async (e) => {
    e.preventDefault();
    
    // Validazione semplice
    if (!description || !amount || !date || !category) {
      setError('Per favore, compila tutti i campi.');
      return;
    }
    
    try {
      await addDoc(collection(db, 'expenses'), {
        description,
        amount: parseFloat(amount),
        date: Timestamp.fromDate(new Date(date)),
        category,
        createdAt: Timestamp.now(),
      });
      navigate('/expenses');
    } catch (err) {
      console.error('Errore durante l\'aggiunta della spesa:', err);
      setError('Errore durante l\'aggiunta della spesa');
    }
  };
  
  return (
    <Layout>
      <div className="page-container">
        <div className="card">
          <div className="page-header">
            <h1 className="page-title">Aggiungi Spesa</h1>
            <p className="page-subtitle">Registra una nuova spesa operativa per mantenere aggiornati i report economici.</p>
          </div>
          {error && <p className="error-message">{error}</p>}
          <form onSubmit={handleAddExpense} className="form-container">
          <div className="form-grid">
            <label className="form-field">
              <span>Descrizione</span>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </label>

            <label className="form-field">
              <span>Importo (€)</span>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>

            <label className="form-field">
              <span>Data</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>

            <label className="form-field">
              <span>Categoria</span>
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
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn--primary">
              Salva Spesa
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => navigate('/expenses')}>
              Annulla
            </button>
          </div>
        </form>
        </div>
      </div>
    </Layout>
  );
}

export default AddExpense;
