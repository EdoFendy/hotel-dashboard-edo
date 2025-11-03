import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  Timestamp, 
  doc, 
  deleteDoc 
} from 'firebase/firestore';
import Layout from '../components/Layout';
import { format, subDays, subMonths, subYears } from 'date-fns';
import { it } from 'date-fns/locale';
import '../styles/Expenses.css';
import { Link } from 'react-router-dom';

/**
 * Componente per visualizzare e filtrare le spese
 */
function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [filter, setFilter] = useState('all'); // 'week', 'month', 'year', 'all'

  useEffect(() => {
    const expensesRef = collection(db, 'expenses');
    let q = expensesRef;

    const now = new Date();

    if (filter === 'week') {
      const oneWeekAgo = subDays(now, 7);
      q = query(expensesRef, where('date', '>=', Timestamp.fromDate(oneWeekAgo)));
    } else if (filter === 'month') {
      const oneMonthAgo = subMonths(now, 1);
      q = query(expensesRef, where('date', '>=', Timestamp.fromDate(oneMonthAgo)));
    } else if (filter === 'year') {
      const oneYearAgo = subYears(now, 1);
      q = query(expensesRef, where('date', '>=', Timestamp.fromDate(oneYearAgo)));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const expensesData = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setExpenses(expensesData);
    });

    return () => unsubscribe();
  }, [filter]);

  /**
   * Funzione per cancellare una spesa dal Firestore
   */
  const handleDelete = async (expenseId) => {
    try {
      const expenseDocRef = doc(db, 'expenses', expenseId);
      await deleteDoc(expenseDocRef);
      console.log(`Spesa con id ${expenseId} cancellata correttamente.`);
    } catch (error) {
      console.error('Errore durante la cancellazione della spesa:', error);
    }
  };

  return (
    <Layout>
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">Gestione Spese</h1>
          <p className="page-subtitle">Monitora i costi operativi dell'hotel con filtri rapidi e azioni immediate.</p>
        </div>

        <div className="card">
          <Link to="/expenses/add" className="btn btn--primary">
            + Aggiungi Spesa
          </Link>
          <div className="filter-buttons" role="group" aria-label="Filtri periodo spese">
            <button
              type="button"
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              Tutto
            </button>
            <button
              type="button"
              className={`filter-btn ${filter === 'week' ? 'active' : ''}`}
              onClick={() => setFilter('week')}
            >
              Ultima Settimana
            </button>
            <button
              type="button"
              className={`filter-btn ${filter === 'month' ? 'active' : ''}`}
              onClick={() => setFilter('month')}
            >
              Ultimo Mese
            </button>
            <button
              type="button"
              className={`filter-btn ${filter === 'year' ? 'active' : ''}`}
              onClick={() => setFilter('year')}
            >
              Ultimo Anno
            </button>
          </div>
        </div>

        <div className="table-wrapper" role="region" aria-live="polite">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Descrizione</th>
                <th scope="col">Importo (€)</th>
                <th scope="col">Categoria</th>
                <th scope="col">Data</th>
                <th scope="col">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td data-label="Descrizione">{expense.description || ''}</td>
                  <td data-label="Importo (€)">
                    <strong>€ {expense.amount ? expense.amount.toFixed(2) : '0.00'}</strong>
                  </td>
                  <td data-label="Categoria">{expense.category || ''}</td>
                  <td data-label="Data">
                    {expense.date
                      ? format(expense.date.toDate(), 'dd MMM yyyy', { locale: it })
                      : ''}
                  </td>
                  <td data-label="Azioni">
                    <div className="actions-group">
                      <Link
                        to={`/expenses/edit/${expense.id}`}
                        className="btn btn-sm btn--primary"
                      >
                        Modifica
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(expense.id)}
                        className="btn btn-sm"
                        style={{ background: 'var(--color-danger)', color: 'white' }}
                      >
                        Cancella
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}

export default Expenses;
