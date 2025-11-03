// src/pages/ReservationsList.jsx

import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, Timestamp, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import ReservationQuickView from '../components/ReservationQuickView';
import AddReservationDrawer from '../components/AddReservationDrawer';
import '../styles/ReservationsList.css';
import { downloadInvoicePDF, generateInvoiceNumber } from '../utils/invoiceGenerator';
import { summarizeReservationPricing } from '../utils/pricing';

const RESERVATION_STATUSES = {
  in_attesa: { label: 'In Attesa', color: 'orange' },
  confermata: { label: 'Confermata', color: 'green' },
  annullata: { label: 'Annullata', color: 'red' },
  conclusa: { label: 'Conclusa', color: 'blue' },
};

const getStatusColor = (status) => {
  const statusObj = RESERVATION_STATUSES[status];
  return statusObj ? statusObj.color : 'grey';
};

const getStatusLabel = (status) => {
  const statusObj = RESERVATION_STATUSES[status];
  return statusObj ? statusObj.label : 'Sconosciuto';
};

const getRoomsWithCribs = (roomCribs) => {
  if (!roomCribs) return 'Nessuna';
  const rooms = Object.entries(roomCribs)
    .filter(([_, hasCrib]) => hasCrib)
    .map(([roomNumber]) => roomNumber);
  return rooms.length > 0 ? rooms.join(', ') : 'Nessuna';
};

const getNumberOfPeople = (reservation) => {
  return reservation.numberOfPeople ?? reservation.totalPeople ?? 0;
};

function ReservationsList() {
  const [reservations, setReservations] = useState([]);
  const [filteredReservations, setFilteredReservations] = useState([]);

  // Filtri
  const [filterName, setFilterName] = useState('');
  const [filterStatuses, setFilterStatuses] = useState([]);
  const [filterDate, setFilterDate] = useState('');

  // Ordinamento
  const [sortOrder, setSortOrder] = useState('desc');

  // Stato per il Check Out
  const [checkoutReservation, setCheckoutReservation] = useState(null);

  // Stato per Quick View
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [selectedReservationId, setSelectedReservationId] = useState(null);
  
  // Stato per Add Reservation Drawer
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);

  // Stato per paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Listener per aprire prenotazioni da conflitti
  useEffect(() => {
    const handleOpenReservation = (e) => {
      setSelectedReservationId(e.detail.reservationId);
      setQuickViewOpen(true);
    };

    window.addEventListener('openReservation', handleOpenReservation);
    return () => window.removeEventListener('openReservation', handleOpenReservation);
  }, []);

  useEffect(() => {
    const reservationsRef = collection(db, 'reservations');
    const unsubscribe = onSnapshot(
      reservationsRef,
      (snapshot) => {
        const reservationsData = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setReservations(reservationsData);
        console.log('Prenotazioni aggiornate:', reservationsData);
      },
      (error) => {
        console.error('Errore nel recupero delle prenotazioni:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let filtered = [...reservations];

    // Filtri
    if (filterName.trim() !== '') {
      filtered = filtered.filter((reservation) =>
        reservation.guestName?.toLowerCase().includes(filterName.toLowerCase())
      );
    }

    if (filterStatuses.length > 0) {
      filtered = filtered.filter((reservation) =>
        filterStatuses.includes(reservation.status)
      );
    }

    if (filterDate !== '') {
      const selectedDate = new Date(filterDate);
      filtered = filtered.filter((reservation) => {
        const checkIn = reservation.checkInDate?.toDate();
        const checkOut = reservation.checkOutDate?.toDate();
        if (!checkIn || !checkOut) return false;
        return (
          checkIn.toDateString() === selectedDate.toDateString() ||
          checkOut.toDateString() === selectedDate.toDateString()
        );
      });
    }

    // Ordinamento per data di Check-in
    filtered.sort((a, b) => {
      const dateA = a.checkInDate?.toDate();
      const dateB = b.checkInDate?.toDate();
      if (!dateA || !dateB) return 0;
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    setFilteredReservations(filtered);
    console.log('Prenotazioni filtrate:', filtered);
  }, [reservations, filterName, filterStatuses, filterDate, sortOrder]);

  const getReservationStatus = (status) => {
    return RESERVATION_STATUSES[status] || { label: 'N/A', color: 'grey' };
  };

  // Calcola prenotazioni da mostrare nella pagina corrente
  const totalPages = Math.ceil(filteredReservations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedReservations = filteredReservations.slice(startIndex, endIndex);

  // ----------------------------
  // QUI sta la modifica fondamentale
  // ----------------------------
  const handleCheckOut = (reservation) => {
    const summary = summarizeReservationPricing(reservation);
    const finalTotal = summary.includesExtras ? summary.savedPrice : summary.calculatedTotal;
    const totalToPay = (finalTotal - summary.deposit).toFixed(2);
    setCheckoutReservation({ ...reservation, totalExtras: summary.extrasTotal, totalToPay });
  };

  const confirmCheckOut = async () => {
    console.log('Pulsante Conferma cliccato');

    try {
      // 1. Ottieni numero fattura progressivo
      const invoicesRef = collection(db, 'invoices');
      const q = query(invoicesRef, orderBy('createdAt', 'desc'), limit(1));
      const snapshot = await getDocs(q);
      const lastInvoiceCount = snapshot.empty ? 0 : (snapshot.docs[0].data().invoiceCount || 0);
      const newInvoiceCount = lastInvoiceCount + 1;
      const invoiceNumber = generateInvoiceNumber(newInvoiceCount);

      // 2. Calcola totali (centralizzati)
      const summary = summarizeReservationPricing(checkoutReservation);
      const finalTotal = summary.includesExtras ? summary.savedPrice : summary.calculatedTotal;
      const totalAmount = Math.max(0, finalTotal - summary.deposit);

      // 3. Salva fattura in Firestore
      const invoiceData = {
        invoiceNumber,
        invoiceCount: newInvoiceCount,
        reservationId: checkoutReservation.id,
        guestName: checkoutReservation.guestName,
        phoneNumber: checkoutReservation.phoneNumber || '',
        checkInDate: checkoutReservation.checkInDate,
        checkOutDate: checkoutReservation.checkOutDate,
        roomNumbers: checkoutReservation.roomNumbers || [checkoutReservation.roomNumber],
        price: summary.savedPrice,
        totalExtras: summary.extrasTotal,
        deposit: summary.deposit,
        totalAmount,
        status: 'paid',
        createdAt: Timestamp.now(),
        // Salva dati completi per rigenerare PDF
        reservationData: {
          ...checkoutReservation,
          totalPeople: checkoutReservation.totalPeople || getNumberOfPeople(checkoutReservation),
        },
      };

      await addDoc(invoicesRef, invoiceData);
      console.log('Fattura salvata in Firestore:', invoiceNumber);

      // 4. Aggiorna prenotazione
      const reservationRef = doc(db, 'reservations', checkoutReservation.id);
      await updateDoc(reservationRef, {
        status: 'conclusa',
        paymentCompleted: true,
        invoiceNumber, // Collega fattura a prenotazione
      });
      console.log('Prenotazione aggiornata con successo');

      // 5. Genera e scarica PDF
      downloadInvoicePDF(checkoutReservation, invoiceNumber);

      setCheckoutReservation(null);
      alert(`Check Out completato! Fattura ${invoiceNumber} generata e salvata.`);
    } catch (error) {
      console.error('Errore durante il Check Out:', error);
      alert('Si è verificato un errore durante il Check Out. Riprova.');
    }
  };

  const handleArrivalToggle = async (reservationId, currentState) => {
    try {
      const reservationRef = doc(db, 'reservations', reservationId);
      await updateDoc(reservationRef, {
        guestsArrived: !currentState,
      });
      console.log(`Stato "Arrivati" aggiornato per la prenotazione ${reservationId}`);
    } catch (error) {
      console.error('Errore nell\'aggiornamento dello stato "Arrivati":', error);
      alert('Si è verificato un errore nell\'aggiornamento dello stato "Arrivati". Riprova.');
    }
  };

  return (
    <Layout>
      <div className="reservations-list">
        <h2>Lista Prenotazioni</h2>
        <Link to="/reservations/new" className="add-btn">
          Aggiungi Prenotazione
        </Link>

        {/* Sezione Filtri */}
        <div className="filters">
          <div className="filter-group">
            <label htmlFor="filterName">Nome Ospite:</label>
            <input
              id="filterName"
              type="text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Cerca per nome"
            />
          </div>

          <div className="filter-group">
            <label>Stato Prenotazione:</label>
            <div className="checkbox-group">
              {Object.entries(RESERVATION_STATUSES).map(([key, status]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    value={key}
                    checked={filterStatuses.includes(key)}
                    onChange={(e) => {
                      const { value, checked } = e.target;
                      if (checked) {
                        setFilterStatuses((prev) => [...prev, value]);
                      } else {
                        setFilterStatuses((prev) =>
                          prev.filter((s) => s !== value)
                        );
                      }
                    }}
                  />
                  {status.label}
                </label>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <label htmlFor="filterDate">Data (Check-in/Check-out):</label>
            <input
              id="filterDate"
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>

          {/* Selettore per Ordinamento */}
          <div className="filter-group">
            <label htmlFor="sortOrder">Ordina per Check-in:</label>
            <select
              id="sortOrder"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              defaultValue="desc"
            >
              <option value="asc">Dal più vicino al più lontano</option>
              <option value="desc">Dal più lontano al più vicino</option>
            </select>
          </div>
        </div>

        {/* Visualizzazione a Tabella (Desktop) */}
        <div className="reservations-table-container">
          {filteredReservations.length > 0 ? (
            <div className="reservations-table-wrapper">
              <table className="reservations-table">
                <thead>
                  <tr>
                    <th>Nome Ospite</th>
                    <th>Telefono</th>
                    <th>Stanza</th>
                    <th>Check-in</th>
                    <th>Check-out</th>
                    {/* <th>Prezzo (€)</th>
                    <th>Extra (€)</th>
                    <th>Persone</th>
                 {/*   <th>Caparra (€)</th> */}
                    <th>Arrivati</th>
                    <th>Stato</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedReservations.map((reservation) => {
                    const status = getReservationStatus(reservation.status);
                    const rooms = Array.isArray(reservation.roomNumbers)
                      ? reservation.roomNumbers.join(', ')
                      : reservation.roomNumber;
                    const numberOfPeople = getNumberOfPeople(reservation);
                    const guestsArrived = reservation.guestsArrived || false;

                  // Calcolo dei campi prezzo
                  const summary = summarizeReservationPricing(reservation);
                  const finalTotal = summary.includesExtras ? summary.savedPrice : summary.calculatedTotal;
                  const totalToPay = (finalTotal - summary.deposit).toFixed(2);

                  return (
                    <tr key={reservation.id}>
                      <td data-label="Nome Ospite">{reservation.guestName}</td>
                      <td data-label="Telefono">{reservation.phoneNumber}</td>
                      <td data-label="Stanza">{rooms}</td>
                      <td data-label="Check-in">
                        {reservation.checkInDate
                          ? reservation.checkInDate.toDate().toLocaleDateString()
                          : 'N/A'}
                      </td>
                      <td data-label="Check-out">
                        {reservation.checkOutDate
                          ? reservation.checkOutDate.toDate().toLocaleDateString()
                          : 'N/A'}
                      </td>
                      {/* <td data-label="Prezzo (€)">
                        € {Number(price).toFixed(2)}
                      </td> */}
                      {/* <td data-label="Extra (€)">
                        € {Number(totalExtras).toFixed(2)}
                      </td> */}
                      {/* <td data-label="Persone">{numberOfPeople}</td> */}
                     {/* <td data-label="Caparra (€)">€ {Number(deposit).toFixed(2)}</td> */}
                      <td data-label="Arrivati">
                        <input
                          type="checkbox"
                          checked={guestsArrived}
                          onChange={() => handleArrivalToggle(reservation.id, guestsArrived)}
                        />
                      </td>
                      <td data-label="Stato">
                        <span className={`status-badge status-badge--${reservation.status}`}>
                          <span className="status-dot"></span>
                          {status.label}
                        </span>
                      </td>
                      <td data-label="Azione">
                        <div className="reservation-actions">
                          <button
                            className="btn btn--secondary"
                            onClick={() => {
                              setSelectedReservationId(reservation.id);
                              setQuickViewOpen(true);
                            }}
                            title="Visualizza dettagli"
                          >
                            👁️ Visualizza
                          </button>
                          <Link
                            to={`/reservations/delete/${reservation.id}`}
                            className="btn btn--destructive"
                          >
                            Elimina
                          </Link>
                          <button
                            className="btn btn--primary"
                            disabled={reservation.status === 'conclusa'}
                            onClick={() => handleCheckOut(reservation)}
                          >
                            Check Out
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="nessuna-prenotazione">Nessuna prenotazione trovata.</p>
          )}
        </div>

        {/* Visualizzazione a Card (Mobile) */}
        <div className="reservations-cards">
          {paginatedReservations.length > 0 ? (
            paginatedReservations.map((reservation) => {
              const status = getReservationStatus(reservation.status);
              const rooms = Array.isArray(reservation.roomNumbers)
                ? reservation.roomNumbers.join(', ')
                : reservation.roomNumber;
              const numberOfPeople = getNumberOfPeople(reservation);
              const guestsArrived = reservation.guestsArrived || false;

              // Calcolo dei campi prezzo
              const summary = summarizeReservationPricing(reservation);
              const finalTotal = summary.includesExtras ? summary.savedPrice : summary.calculatedTotal;
              const totalToPay = (finalTotal - summary.deposit).toFixed(2);

              return (
                <div key={reservation.id} className="reservation-card">
                  <h3>{reservation.guestName}</h3>
                  <div className="reservation-details">
                    <div>
                      <label>Numero Telefono:</label> {reservation.phoneNumber}
                    </div>
                    <div>
                      <label>Numero Stanza:</label> {rooms}
                    </div>
                    <div>
                      <label>Check-in:</label>{' '}
                      {reservation.checkInDate
                        ? reservation.checkInDate.toDate().toLocaleDateString()
                        : 'N/A'}
                    </div>
                    <div>
                      <label>Check-out:</label>{' '}
                      {reservation.checkOutDate
                        ? reservation.checkOutDate.toDate().toLocaleDateString()
                        : 'N/A'}
                    </div>
                    <div>
                      <label>Prezzo (€):</label> € {Number(summary.savedPrice).toFixed(2)}
                    </div>
                    <div>
                      <label>Extra (€):</label> € {Number(summary.extrasTotal).toFixed(2)}
                    </div>
                    <div>
                      <label>Numero Persone:</label> {numberOfPeople}
                    </div>
                    <div>
                      <label>Caparra (€):</label> € {summary.deposit.toFixed(2)}
                    </div>
                    <div className="arrival-checkbox">
                      <label>
                        <input
                          type="checkbox"
                          checked={guestsArrived}
                          onChange={() =>
                            handleArrivalToggle(reservation.id, guestsArrived)
                          }
                        />
                        Arrivati
                      </label>
                    </div>
                    <div className="status">
                      <span className={`status-badge status-badge--${reservation.status}`}>
                        <span className="status-dot"></span>
                        {status.label}
                      </span>
                    </div>
                  </div>
                  <div className="actions">
                    <button
                      className="btn btn--secondary"
                      onClick={() => {
                        setSelectedReservationId(reservation.id);
                        setQuickViewOpen(true);
                      }}
                    >
                      👁️ Visualizza
                    </button>
                    <Link
                      to={`/reservations/delete/${reservation.id}`}
                      className="btn btn--destructive"
                    >
                      Elimina
                    </Link>
                    <button
                      className="btn btn--primary"
                      disabled={reservation.status === 'conclusa'}
                      onClick={() => handleCheckOut(reservation)}
                    >
                      Check Out
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="nessuna-prenotazione">Nessuna prenotazione trovata.</p>
          )}
        </div>

        {/* Controlli Paginazione */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 'clamp(0.5rem, 2vw, 1rem)',
            padding: '1.5rem 0',
            marginTop: '1rem',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="btn btn-sm"
              style={{
                opacity: currentPage === 1 ? 0.5 : 1,
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
              }}
            >
              ← Precedente
            </button>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              fontSize: '0.95rem',
              color: 'rgba(15, 23, 42, 0.75)'
            }}>
              <span>Pagina</span>
              <strong style={{ color: '#15294F' }}>{currentPage}</strong>
              <span>di</span>
              <strong>{totalPages}</strong>
              <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                ({filteredReservations.length} totali)
              </span>
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="btn btn-sm"
              style={{
                opacity: currentPage === totalPages ? 0.5 : 1,
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              Successiva →
            </button>
          </div>
        )}

        {/* Modal per il Check Out */}
        {checkoutReservation && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Check Out - {checkoutReservation.guestName}</h3>
              {console.log('Modal aperto con prenotazione:', checkoutReservation)}

              {/* Tabella Dati Ospite */}
              <table className="modal-table">
                <tbody>
                  <tr>
                    <td><strong>Nome Ospite:</strong></td>
                    <td>{checkoutReservation.guestName || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td><strong>Numero Telefono:</strong></td>
                    <td>{checkoutReservation.phoneNumber || 'N/A'}</td>
                  </tr>
                </tbody>
              </table>

              {/* Tabella Dettagli Stanza e Date */}
              <table className="modal-table">
                <tbody>
                  <tr>
                    <td><strong>Numero Stanza:</strong></td>
                    <td>
                      {Array.isArray(checkoutReservation.roomNumbers)
                        ? checkoutReservation.roomNumbers.join(', ')
                        : checkoutReservation.roomNumber || 'N/A'}
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Check-in:</strong></td>
                    <td>
                      {checkoutReservation.checkInDate
                        ? checkoutReservation.checkInDate.toDate().toLocaleDateString()
                        : 'N/A'}
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Check-out:</strong></td>
                    <td>
                      {checkoutReservation.checkOutDate
                        ? checkoutReservation.checkOutDate.toDate().toLocaleDateString()
                        : 'N/A'}
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Numero Notti:</strong></td>
                    <td>
                      {Math.max(
                        1,
                        Math.ceil(
                          (checkoutReservation.checkOutDate.toDate() -
                            checkoutReservation.checkInDate.toDate()) /
                            (1000 * 60 * 60 * 24)
                        )
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Tabella Prezzi Totali */}
              <table className="modal-table">
                <tbody>
                  <tr>
                    <td><strong>Prezzo Totale:</strong></td>
                    <td>€ {Number(checkoutReservation.price || 0).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td><strong>Extras Totali:</strong></td>
                    <td>€ {Number(checkoutReservation.totalExtras || 0).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td><strong>Caparra Versata:</strong></td>
                    <td>-€ {Number(checkoutReservation.deposit || 0).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td><strong>Totale da Pagare:</strong></td>
                    <td>€ {Number(checkoutReservation.totalToPay || 0).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Suddivisione Prezzi per Camera */}
              {checkoutReservation.roomPrices &&
                Array.isArray(checkoutReservation.roomNumbers) && (
                  <div>
                    <strong>Suddivisione Prezzi per Camera:</strong>
                    <table className="modal-table">
                      <tbody>
                        {checkoutReservation.roomNumbers.map((room) => (
                          <tr key={room}>
                            <td>Stanza {room}:</td>
                            <td>
                              € {Number(checkoutReservation.roomPrices[room] || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

              {/* Extras per Camera (inclusa la culla) */}
              {checkoutReservation.extraPerRoom &&
                Array.isArray(checkoutReservation.roomNumbers) && (
                  <div>
                    <strong>Extras per Camera:</strong>
                    {checkoutReservation.roomNumbers.map((room) => {
                      const extras = checkoutReservation.extraPerRoom[room] || {};
                      return (
                        <div key={room} className="room-extras-checkout">
                          <h4>Stanza {room}</h4>
                          <table className="modal-table">
                            <tbody>
                              <tr>
                                <td>Extra Pet:</td>
                                <td>{extras.petAllowed ? 'Sì (+10€)' : 'No'}</td>
                              </tr>
                              <tr>
                                <td>Extra Bar:</td>
                                <td>€ {Number(extras.extraBar || 0).toFixed(2)}</td>
                              </tr>
                              <tr>
                                <td>Extra Servizi:</td>
                                <td>€ {Number(extras.extraServizi || 0).toFixed(2)}</td>
                              </tr>
                              {/* Aggiunta della Culla se necessaria */}
                              {checkoutReservation.roomCribs &&
                                checkoutReservation.roomCribs[room] && (
                                  <tr>
                                    <td>Culla:</td>
                                    <td>€ 10.00</td>
                                  </tr>
                                )}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                )}

              {/* Tabella Informazioni Aggiuntive */}
              <table className="modal-table">
                <tbody>
                  <tr>
                    <td><strong>Numero Totale di Persone:</strong></td>
                    <td>{getNumberOfPeople(checkoutReservation)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Tasto Conferma */}
              <div className="modal-buttons">
                <button className="btn confirm-btn" onClick={confirmCheckOut}>
                  Conferma
                </button>
                <button
                  className="btn cancel-btn"
                  onClick={() => setCheckoutReservation(null)}
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick View Drawer */}
        <ReservationQuickView
          reservationId={selectedReservationId}
          isOpen={quickViewOpen}
          onClose={() => {
            setQuickViewOpen(false);
            setSelectedReservationId(null);
          }}
          onUpdate={() => {
            // Reservations will auto-update via onSnapshot
          }}
        />

        {/* Add Reservation Drawer */}
        <AddReservationDrawer
          isOpen={addDrawerOpen}
          onClose={() => setAddDrawerOpen(false)}
          onSuccess={() => {
            // Reservations will auto-update via onSnapshot
          }}
        />

        {/* Floating Action Button */}
        <button
          onClick={() => setAddDrawerOpen(true)}
          className="fab"
          title="Aggiungi Prenotazione"
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #15294F 0%, #1a2744 100%)',
            color: 'white',
            border: 'none',
            boxShadow: '0 4px 12px rgba(14, 23, 42, 0.5)',
            cursor: 'pointer',
            fontSize: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            zIndex: 100,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(14, 23, 42, 0.7)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(14, 23, 42, 0.5)';
          }}
        >
          +
        </button>
      </div>
    </Layout>
  );
}

export default ReservationsList;
