// src/pages/CalendarPage.jsx

import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import styles from '../styles/CalendarPage.module.css';
import ReservationQuickView from '../components/ReservationQuickView';
import AddReservationDrawer from '../components/AddReservationDrawer';
import '../styles/common.css';

// Mappa dei colori per gli stati delle prenotazioni e per i gruppi
const STATUS_COLORS = {
  in_attesa: '#FFA500',
  confermata: '#28a745',
  annullata: '#dc3545',
  conclusa: '#007bff',
  gruppo: '#EE82EE',
};

/**
 * Componente per la leggenda dei colori
 */
const Legend = ({ groups }) => {
  return (
    <div className={styles.legend}>
      <h4>Legenda</h4>
      <ul>
        {Object.entries(STATUS_COLORS).map(([status, color]) => {
          return (
            <li key={status}>
              <span className={styles.legendColor} style={{ backgroundColor: color }}></span>
              {status.replace('_', ' ').toUpperCase()}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/**
 * Helper: ottiene le camere che hanno una culla
 */
const getRoomsWithCribs = (roomCribs) => {
  if (!roomCribs) return 'No';
  const rooms = Object.entries(roomCribs)
    .filter(([_, hasCrib]) => hasCrib)
    .map(([roomNumber]) => roomNumber);
  return rooms.length > 0 ? rooms.join(', ') : 'No';
};

/**
 * Pagina Calendario con funzionalità checkout
 */
function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [isBooking, setIsBooking] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]);
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);

  // Stati per checkout
  const [checkoutReservation, setCheckoutReservation] = useState(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  
  // Stato per Quick View
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [selectedReservationId, setSelectedReservationId] = useState(null);
  
  // Stato per Add Reservation Drawer
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);

  // Stato per paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Reset paginazione quando cambia il mese
  useEffect(() => {
    setCurrentPage(1);
  }, [currentMonth]);

  // Listener per aprire prenotazioni da conflitti
  useEffect(() => {
    const handleOpenReservation = (e) => {
      setSelectedReservationId(e.detail.reservationId);
      setQuickViewOpen(true);
    };

    window.addEventListener('openReservation', handleOpenReservation);
    return () => window.removeEventListener('openReservation', handleOpenReservation);
  }, []);

  // Carica tutte le prenotazioni da Firestore
  useEffect(() => {
    const reservationsRef = collection(db, 'reservations');
    const unsubscribe = onSnapshot(
      reservationsRef,
      (snapshot) => {
        const reservationsData = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        // Identifica tutti i gruppi
        const uniqueGroups = [
          ...new Set(
            reservationsData
              .filter((res) => res.isGroup && res.agencyGroupName)
              .map((res) => res.agencyGroupName)
          ),
        ];
        setGroups(uniqueGroups);

        // Assegna un colore a ciascun gruppo
        const updatedEvents = reservationsData.flatMap((reservation) => {
          const status = reservation.status || 'in_attesa';

          const checkInDate = new Date(reservation.checkInDate.toDate());
          const checkOutDate = new Date(reservation.checkOutDate.toDate());
          checkInDate.setHours(0, 0, 0, 0);
          checkOutDate.setHours(0, 0, 0, 0);

          // Se roomNumbers è un array => prenotazione multipla
          if (Array.isArray(reservation.roomNumbers)) {
            return reservation.roomNumbers.map((roomNumber) => {
              let occupantName = reservation.guestName || 'Prenotazione';
              if (reservation.isGroup && reservation.roomCustomNames) {
                occupantName =
                  reservation.roomCustomNames[roomNumber] || occupantName;
              }

              let bgColor = STATUS_COLORS[status] || '#6c757d';
              if (reservation.isGroup && reservation.agencyGroupName) {
                bgColor = STATUS_COLORS['gruppo'];
              }

              return {
                id: `${reservation.id}-${roomNumber}`,
                title: occupantName,
                start: checkInDate,
                end: checkOutDate,
                backgroundColor: bgColor,
                extendedProps: {
                  ...reservation,
                  roomNumber,
                  occupantName,
                },
              };
            });
          } else {
            // Prenotazione singola
            const occupantName = reservation.guestName || 'Prenotazione';
            const roomNumber = reservation.roomNumber || 'N/A';

            let bgColor = STATUS_COLORS[status] || '#6c757d';
            if (reservation.isGroup && reservation.agencyGroupName) {
              bgColor = STATUS_COLORS['gruppo'];
            }

            return {
              id: reservation.id,
              title: occupantName,
              start: checkInDate,
              end: checkOutDate,
              backgroundColor: bgColor,
              extendedProps: {
                ...reservation,
                roomNumber,
                occupantName,
              },
            };
          }
        });

        setEvents(updatedEvents);
      },
      (error) => {
        console.error('Errore nel recupero delle prenotazioni:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  // Genera i giorni del mese corrente
  const generateDays = (date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const days = [];
    for (let i = 1; i <= end.getDate(); i++) {
      const day = new Date(date.getFullYear(), date.getMonth(), i);
      day.setHours(0, 0, 0, 0);
      days.push(day);
    }
    return days;
  };

  // Helper per normalizzare la data a mezzanotte
  const normalizeDate = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Giorni del mese
  const days = generateDays(currentMonth);

  // Filtra gli "eventi" (prenotazioni) per il mese corrente
  const filteredEvents = events.filter((ev) => {
    const evStart = normalizeDate(ev.start);
    const evEnd = normalizeDate(ev.end);
    return (
      (evStart.getFullYear() === currentMonth.getFullYear() &&
        evStart.getMonth() === currentMonth.getMonth()) ||
      (evEnd.getFullYear() === currentMonth.getFullYear() &&
        evEnd.getMonth() === currentMonth.getMonth())
    );
  });

  // Cambia la modalità prenotazione
  const toggleBookingMode = () => {
    setIsBooking((prev) => !prev);
    setSelectedDates([]);
  };

  // Quando clicchiamo su una prenotazione
  const handleReservationClick = (reservationProps) => {
    // Apri direttamente il Quick View, evitando la modale intermedia
    const resId = reservationProps?.id || reservationProps?.reservationId || null;
    if (resId) {
      setSelectedReservationId(resId);
      setQuickViewOpen(true);
      setSelectedReservation(null);
    }
  };

  // Gestisce il checkout
  const handleCheckOut = (reservation) => {
    setCheckoutReservation(reservation);
    setCheckoutModalOpen(true);
    setSelectedReservation(null);
  };

  // Conferma checkout
  const confirmCheckOut = async () => {
    if (!checkoutReservation) return;

    try {
      const reservationRef = doc(db, 'reservations', checkoutReservation.id);
      await updateDoc(reservationRef, {
        status: 'conclusa',
        paymentCompleted: true,
        checkOutDate: Timestamp.fromDate(new Date()),
        // keep stored price fields as they are; summary is just for UI/consistency
      });
      setCheckoutModalOpen(false);
      setCheckoutReservation(null);
      alert('Check-out completato con successo!');
    } catch (error) {
      console.error('Errore durante il check-out:', error);
      alert('Errore durante il check-out. Riprova.');
    }
  };

  // Quando clicchiamo su una cella disponibile
  const handleEmptyCellClick = (dayStr) => {
    if (!isBooking) return;
    if (selectedDates.length === 0) {
      setSelectedDates([dayStr]);
    } else if (selectedDates.length === 1) {
      if (dayStr === selectedDates[0]) {
        setSelectedDates([]);
      } else {
        const sorted = [selectedDates[0], dayStr].sort();
        navigate('/reservations/new', {
          state: {
            checkInDate: sorted[0],
            checkOutDate: sorted[1],
          },
        });
        setSelectedDates([]);
        setIsBooking(false);
      }
    }
  };

  // Rende la tabella "Vista Lista"
  const renderListView = () => {
    return (
      <div className={styles.roomTableContainer}>
        <div className={styles.tableContainer}>
          <table className={styles.listTable}>
            <thead>
              <tr>
                <th>Stanza</th>
                {days.map((day, i) => (
                  <th key={i}>{day.getDate()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 16 }, (_, i) => i + 1)
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map((roomNumber) => (
                <tr key={roomNumber}>
                  <td>C. {roomNumber}</td>
                  {days.map((day, idx) => {
                    const dayStr = format(day, 'yyyy-MM-dd');

                    const foundEvent = filteredEvents.find((ev) => {
                      const evStart = normalizeDate(ev.start);
                      const evEnd = normalizeDate(ev.end);

                      return (
                        ev.extendedProps.roomNumber === roomNumber &&
                        day >= evStart &&
                        day < evEnd
                      );
                    });

                    let cellClass = styles.listCell;
                    let bgColor = '#f0f0f0';
                    let occupantLabel = '';

                    if (foundEvent) {
                      cellClass += ` ${styles.occupied}`;
                      bgColor = foundEvent.backgroundColor || '#f0f0f0';
                      occupantLabel = foundEvent.extendedProps.occupantName;

                      if (
                        foundEvent.extendedProps.isGroup &&
                        foundEvent.extendedProps.agencyGroupName
                      ) {
                        occupantLabel += ` (${foundEvent.extendedProps.agencyGroupName})`;
                      }
                    } else {
                      cellClass += ` ${styles.available}`;
                    }

                    if (isBooking && selectedDates.includes(dayStr)) {
                      cellClass += ` ${styles.selected}`;
                    }

                    return (
                      <td
                        key={idx}
                        className={cellClass}
                        style={{
                          backgroundColor: bgColor,
                          whiteSpace: 'nowrap',
                          overflow: 'visible',
                          textOverflow: 'clip',
                        }}
                        title={
                          foundEvent
                            ? `Prenotazione: ${
                                foundEvent.extendedProps.isGroup
                                  ? foundEvent.extendedProps.agencyGroupName
                                  : foundEvent.extendedProps.guestName
                              }`
                            : 'Disponibile'
                        }
                        onClick={() => {
                          if (foundEvent) {
                            handleReservationClick(foundEvent.extendedProps);
                          } else {
                            handleEmptyCellClick(dayStr);
                          }
                        }}
                      >
                        {occupantLabel}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Controlli Paginazione Camere */}
        {Math.ceil(16 / itemsPerPage) > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 'clamp(0.5rem, 2vw, 1rem)',
            padding: '1rem 0',
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
              <span>Camere</span>
              <strong style={{ color: '#15294F' }}>
                {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, 16)}
              </strong>
              <span>di 16</span>
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(16 / itemsPerPage), prev + 1))}
              disabled={currentPage === Math.ceil(16 / itemsPerPage)}
              className="btn btn-sm"
              style={{
                opacity: currentPage === Math.ceil(16 / itemsPerPage) ? 0.5 : 1,
                cursor: currentPage === Math.ceil(16 / itemsPerPage) ? 'not-allowed' : 'pointer'
              }}
            >
              Successiva →
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout>
      <div className={styles.calendarShell}>
        {/* Barra Legenda Fissa */}
        <div className={styles.calendarLegendBar}>
          <Legend groups={groups} />
          <div className={styles.calendarControls}>
            <button
              className={`${styles.prenotaBtn} ${isBooking ? styles.prenotaBtnActive : ''}`}
              onClick={toggleBookingMode}
            >
              {isBooking ? '✕ Annulla Prenotazione' : '+ Nuova Prenotazione'}
            </button>
            <div className={styles.monthNav}>
              <button
                onClick={() =>
                  setCurrentMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                  )
                }
                className={styles.navButton}
              >
                ← Precedente
              </button>
              <span className={styles.currentMonth}>
                {currentMonth.toLocaleString('it-IT', {
                  month: 'long',
                  year: 'numeric',
                }).toUpperCase()}
              </span>
              <button
                onClick={() =>
                  setCurrentMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                  )
                }
                className={styles.navButton}
              >
                Successivo →
              </button>
            </div>
          </div>
        </div>
        
        {/* Area Calendario Scrollabile */}
        <div className={styles.calendarScrollArea}>
          {renderListView()}

          {/* MODAL: se c'è una prenotazione selezionata */}
          {false && selectedReservation && (
            <div className={styles.modalOverlay}>
              <div className={styles.modal}>
                <button
                  className={styles.modalCloseBtn}
                  onClick={() => setSelectedReservation(null)}
                >
                  &times;
                </button>
                <h3 className={styles.modalTitle}>
                  Dettagli Prenotazione
                  {selectedReservation.isGroup &&
                    selectedReservation.agencyGroupName && (
                      <span className={styles.groupName}>
                        (Gruppo/Agenzia: {selectedReservation.agencyGroupName})
                      </span>
                    )}
                </h3>

                <div className={styles.modalBody}>
                  {/* Sezione Ospite */}
                  <div className="panel" style={{ marginBottom: '1rem' }}>
                    <div className="panel-header">
                      <h4 style={{ margin: 0, fontSize: '1rem' }}>👤 Informazioni Ospite</h4>
                      <span className={`status-badge status-badge--${
                        selectedReservation.status === 'confermata' ? 'success' :
                        selectedReservation.status === 'conclusa' ? 'info' :
                        selectedReservation.status === 'annullata' ? 'danger' : 'warning'
                      }`}>
                        {selectedReservation.status ? selectedReservation.status.replace('_', ' ').toUpperCase() : 'N/A'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <p style={{ margin: 0 }}>
                        <strong>Nome:</strong> {selectedReservation.guestName || 'N/A'}
                      </p>
                      <p style={{ margin: 0 }}>
                        <strong>Telefono:</strong> {selectedReservation.phoneNumber || 'N/A'}
                      </p>
                      {selectedReservation.totalPeople && (
                        <p style={{ margin: 0 }}>
                          <strong>Persone Totali:</strong> {selectedReservation.totalPeople}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Sezione Date e Stanze */}
                  <div className="panel" style={{ marginBottom: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem' }}>📅 Date e Stanze</h4>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      <p style={{ margin: 0 }}>
                        <strong>Check-in:</strong>{' '}
                        {selectedReservation.checkInDate
                          ? format(selectedReservation.checkInDate.toDate(), 'dd/MM/yyyy', { locale: it })
                          : 'N/A'}
                      </p>
                      <p style={{ margin: 0 }}>
                        <strong>Check-out:</strong>{' '}
                        {selectedReservation.checkOutDate
                          ? format(selectedReservation.checkOutDate.toDate(), 'dd/MM/yyyy', { locale: it })
                          : 'N/A'}
                      </p>
                      <p style={{ margin: 0 }}>
                        <strong>Camere:</strong>{' '}
                        {Array.isArray(selectedReservation.roomNumbers)
                          ? selectedReservation.roomNumbers.join(', ')
                          : selectedReservation.roomNumber || 'N/A'}
                      </p>
                    </div>

                    {/* Nominativi Stanze per Gruppi */}
                    {selectedReservation.isGroup && selectedReservation.roomCustomNames && (
                      <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(238, 130, 238, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(238, 130, 238, 0.2)' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#9333ea' }}>📋 Nominativi Stanze:</strong>
                        <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.5rem', display: 'grid', gap: '0.25rem' }}>
                          {Array.isArray(selectedReservation.roomNumbers) && selectedReservation.roomNumbers.map((room) => (
                            <li key={room} style={{ fontSize: '0.85rem' }}>
                              <strong>Stanza {room}:</strong> {selectedReservation.roomCustomNames[room] || '(non specificato)'}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Sezione Economica */}
                  <div className="panel" style={{ marginBottom: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem' }}>💰 Dettagli Economici</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                      {selectedReservation.priceWithoutExtras && (
                        <div>
                          <strong style={{ fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.65)' }}>Prezzo Base:</strong>
                          <p style={{ margin: '0.25rem 0 0', fontSize: '1.1rem', fontWeight: '600' }}>
                            €{Number(selectedReservation.priceWithoutExtras).toFixed(2)}
                          </p>
                        </div>
                      )}
                      {selectedReservation.priceWithExtras && (
                        <div>
                          <strong style={{ fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.65)' }}>Con Extras:</strong>
                          <p style={{ margin: '0.25rem 0 0', fontSize: '1.1rem', fontWeight: '600' }}>
                            €{Number(selectedReservation.priceWithExtras).toFixed(2)}
                          </p>
                        </div>
                      )}
                      <div>
                        <strong style={{ fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.65)' }}>Prezzo Totale:</strong>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: '600', color: '#15294F' }}>
                          €{Number(selectedReservation.price || 0).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <strong style={{ fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.65)' }}>Caparra:</strong>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: '600', color: '#22c55e' }}>
                          €{Number(selectedReservation.deposit || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div style={{ marginTop: '0.75rem' }}>
                      <p style={{ margin: 0, fontSize: '0.9rem' }}>
                        <strong>Pagamento:</strong>{' '}
                        <span style={{ color: selectedReservation.paymentCompleted ? '#22c55e' : '#f59e0b' }}>
                          {selectedReservation.paymentCompleted ? 'Completato ✓' : 'In sospeso'}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Extras per Stanza (per gruppi) */}
                  {selectedReservation.extraPerRoom && Array.isArray(selectedReservation.roomNumbers) && (
                    <div className="panel" style={{ marginBottom: '1rem' }}>
                      <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem' }}>🛎️ Extras per Stanza</h4>
                      <div style={{ display: 'grid', gap: '0.75rem' }}>
                        {selectedReservation.roomNumbers.map((room) => {
                          const extras = selectedReservation.extraPerRoom[room] || {};
                          const roomPrice = selectedReservation.roomPrices?.[room] || 0;
                          const hasCrib = selectedReservation.roomCribs?.[room];
                          
                          return (
                            <div key={room} style={{ 
                              padding: '0.75rem', 
                              background: 'rgba(241, 245, 249, 0.8)', 
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid rgba(226, 232, 240, 0.8)'
                            }}>
                              <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>Stanza {room}</strong>
                              <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', display: 'grid', gap: '0.25rem', color: 'rgba(15, 23, 42, 0.75)' }}>
                                <span>💵 Prezzo/notte: <strong>€{roomPrice}</strong></span>
                                <span>🍹 Extra Bar: €{extras.extraBar || 0}</span>
                                <span>🛎️ Extra Servizi: €{extras.extraServizi || 0}</span>
                                <span>🐾 Pet: {extras.petAllowed ? 'Sì (+10€)' : 'No'}</span>
                                {hasCrib && <span>👶 Culla: Sì (+10€)</span>}
                                <span style={{ color: extras.guestsArrived ? '#22c55e' : '#94a3b8' }}>
                                  {extras.guestsArrived ? '✓ Arrivati' : '○ Non arrivati'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Note */}
                  {selectedReservation.additionalNotes && (
                    <div className="panel" style={{ marginBottom: '1rem', background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
                      <strong style={{ fontSize: '0.9rem', color: '#d97706' }}>📝 Note:</strong>
                      <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: 'rgba(15, 23, 42, 0.75)', whiteSpace: 'pre-wrap' }}>
                        {selectedReservation.additionalNotes}
                      </p>
                    </div>
                  )}

                  {/* Azioni */}
                  <div className={styles.modalActions}>
                    <button
                      className="btn btn-sm btn--primary"
                      onClick={() => {
                        setSelectedReservationId(selectedReservation.id);
                        setQuickViewOpen(true);
                        setSelectedReservation(null);
                      }}
                    >
                      👁️ Visualizza/Modifica
                    </button>
                    
                    {selectedReservation.status !== 'conclusa' && (
                      <button
                        className="btn btn-sm"
                        onClick={() => handleCheckOut(selectedReservation)}
                        style={{ background: 'var(--color-success)', color: 'white' }}
                      >
                        ✓ Check Out
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Checkout Modal */}
          {checkoutModalOpen && checkoutReservation && (
            <div className="modal-overlay">
              <div className="modal-content" style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                  <h3 className="modal-title">Conferma Check-Out</h3>
                  <button 
                    className="modal-close" 
                    onClick={() => {
                      setCheckoutModalOpen(false);
                      setCheckoutReservation(null);
                    }}
                  >
                    ✕
                  </button>
                </div>
                
                <div className="modal-body">
                  <p style={{ marginBottom: '1rem' }}>
                    <strong>Ospite:</strong> {checkoutReservation.guestName}
                  </p>
                  <p style={{ marginBottom: '1rem' }}>
                    <strong>Stanza:</strong> {Array.isArray(checkoutReservation.roomNumbers) 
                      ? checkoutReservation.roomNumbers.join(', ') 
                      : checkoutReservation.roomNumber}
                  </p>
                  <p style={{ marginBottom: '1.5rem', color: 'rgba(15, 23, 42, 0.65)' }}>
                    Confermi di voler effettuare il check-out per questa prenotazione?
                  </p>
                </div>
                
                <div className="modal-footer">
                  <button 
                    className="btn btn--ghost"
                    onClick={() => {
                      setCheckoutModalOpen(false);
                      setCheckoutReservation(null);
                    }}
                  >
                    Annulla
                  </button>
                  <button 
                    className="btn btn--primary"
                    onClick={confirmCheckOut}
                  >
                    Conferma Check-Out
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick View Drawer */}
        <ReservationQuickView
          reservationId={selectedReservationId}
          isOpen={quickViewOpen}
          onClose={() => {
            setQuickViewOpen(false);
            setSelectedReservationId(null);
          }}
          onUpdate={() => {
            // Auto-update via onSnapshot
          }}
        />

        {/* Add Reservation Drawer */}
        <AddReservationDrawer
          isOpen={addDrawerOpen}
          onClose={() => setAddDrawerOpen(false)}
          onSuccess={() => {
            // Auto-update via onSnapshot
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
            background: 'linear-gradient(135deg, #15294F 0%, #1d4ed8 100%)',
            color: 'white',
            border: 'none',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
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
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(37, 99, 235, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.4)';
          }}
        >
          +
        </button>
    </Layout>
  );
}

export default CalendarPage;
