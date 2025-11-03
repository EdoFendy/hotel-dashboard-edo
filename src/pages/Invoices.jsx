// src/pages/Invoices.jsx

import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import Layout from '../components/Layout';
import { downloadInvoicePDF } from '../utils/invoiceGenerator';
import '../styles/Invoices.css';

function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Carica fatture in tempo reale
  useEffect(() => {
    const invoicesRef = collection(db, 'invoices');
    const q = query(invoicesRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const invoicesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setInvoices(invoicesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filtra fatture
  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.guestName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || invoice.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Scarica PDF
  const handleDownloadPDF = (invoice) => {
    try {
      downloadInvoicePDF(invoice.reservationData, invoice.invoiceNumber);
    } catch (error) {
      console.error('Errore download PDF:', error);
      alert('Errore nel download della fattura');
    }
  };

  // Calcola statistiche
  const totalInvoices = invoices.length;
  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
  const currentYear = new Date().getFullYear();
  const yearInvoices = invoices.filter(
    (inv) => inv.createdAt?.toDate().getFullYear() === currentYear
  );

  return (
    <Layout>
      <div className="invoices-page">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">📄 Fatture</h1>
            <p className="page-subtitle">Gestione e download fatture generate</p>
          </div>
        </div>

        {/* Statistiche */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <div className="stat-label">Totale Fatture</div>
              <div className="stat-value">{totalInvoices}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-content">
              <div className="stat-label">Fatturato Totale</div>
              <div className="stat-value">€ {totalRevenue.toFixed(2)}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📅</div>
            <div className="stat-content">
              <div className="stat-label">Fatture {currentYear}</div>
              <div className="stat-value">{yearInvoices.length}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <div className="stat-label">Pagate</div>
              <div className="stat-value">
                {invoices.filter((inv) => inv.status === 'paid').length}
              </div>
            </div>
          </div>
        </div>

        {/* Filtri */}
        <div className="filters-section">
          <div className="search-box">
            <input
              type="text"
              placeholder="🔍 Cerca per nome ospite o numero fattura..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-buttons">
            <button
              className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
              onClick={() => setFilterStatus('all')}
            >
              Tutte
            </button>
            <button
              className={`filter-btn ${filterStatus === 'paid' ? 'active' : ''}`}
              onClick={() => setFilterStatus('paid')}
            >
              Pagate
            </button>
          </div>
        </div>

        {/* Lista Fatture */}
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner" />
            <p>Caricamento fatture...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>Nessuna fattura trovata</h3>
            <p>
              {searchTerm
                ? 'Prova a modificare i filtri di ricerca'
                : 'Le fatture verranno generate automaticamente al checkout delle prenotazioni'}
            </p>
          </div>
        ) : (
          <div className="invoices-table-container">
            <table className="invoices-table">
              <thead>
                <tr>
                  <th>Numero Fattura</th>
                  <th>Data</th>
                  <th>Ospite</th>
                  <th>Camere</th>
                  <th>Importo</th>
                  <th>Stato</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <span className="invoice-number">{invoice.invoiceNumber}</span>
                    </td>
                    <td>
                      {invoice.createdAt
                        ? format(invoice.createdAt.toDate(), 'dd MMM yyyy', { locale: it })
                        : 'N/A'}
                    </td>
                    <td>
                      <div className="guest-info">
                        <div className="guest-name">{invoice.guestName}</div>
                        {invoice.phoneNumber && (
                          <div className="guest-phone">{invoice.phoneNumber}</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="rooms-badge">
                        {Array.isArray(invoice.roomNumbers)
                          ? invoice.roomNumbers.join(', ')
                          : invoice.roomNumbers || 'N/A'}
                      </span>
                    </td>
                    <td>
                      <span className="amount">€ {invoice.totalAmount?.toFixed(2) || '0.00'}</span>
                    </td>
                    <td>
                      <span className={`status-badge status-${invoice.status}`}>
                        {invoice.status === 'paid' ? '✓ Pagata' : invoice.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-download"
                        onClick={() => handleDownloadPDF(invoice)}
                        title="Scarica PDF"
                      >
                        ⬇️ Scarica PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Info Footer */}
        <div className="info-footer">
          <p>
            💡 <strong>Suggerimento:</strong> Le fatture vengono generate automaticamente quando
            completi il checkout di una prenotazione. Puoi scaricarle in qualsiasi momento da
            questa pagina.
          </p>
        </div>
      </div>
    </Layout>
  );
}

export default Invoices;
