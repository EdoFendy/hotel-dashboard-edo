// src/components/ReservationQuickView.jsx

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { doc, getDoc, updateDoc, Timestamp, collection, query, where, getDocs, addDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { it } from 'date-fns/locale';
import useScrollLock from '../hooks/useScrollLock';
import '../styles/common.css';
import { summarizeReservationPricing, buildReservationDraftFromForm, N } from '../utils/pricing';

// Tipi di camere e capacità
const ROOM_TYPES = {
  1: 'Quadrupla',
  2: 'Tripla',
  3: 'Doppia + Bagno per Handicap',
  4: 'Matrimoniale',
  5: 'Singola',
  6: 'Matrimoniale/Doppia',
  7: 'Tripla',
  8: 'Matrimoniale',
  9: 'Matrimoniale/Doppia',
  10: 'Tripla',
  11: 'Quadrupla',
  12: 'Matrimoniale',
  13: 'Matrimoniale',
  14: 'Matrimoniale/Doppia',
  15: 'Tripla',
  16: 'Matrimoniale',
};

const ROOM_CAPACITIES = {
  'Quadrupla': 4,
  'Tripla': 3,
  'Doppia + Bagno per Handicap': 2,
  'Matrimoniale': 2,
  'Singola': 1,
  'Matrimoniale/Doppia': 2,
};

/**
 * Drawer riutilizzabile per visualizzare e modificare rapidamente le prenotazioni
 * Può essere aperto da qualsiasi pagina dell'applicazione
 */
function ReservationQuickView({ reservationId, isOpen, onClose, onUpdate}) {
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [conflictingReservations, setConflictingReservations] = useState([]);
  const [showConflicts, setShowConflicts] = useState(false);
  // Input rapidi per aggiungere extras senza entrare in modifica
  const [quickExtras, setQuickExtras] = useState({}); // { [roomNumber]: { extraBar, extraServizi, petAllowed, culla } }
  
  // Ref per il drawer body
  const drawerBodyRef = useRef(null);

  // Blocca scroll del body quando drawer è aperto
  useScrollLock(isOpen);

  useEffect(() => {
    if (isOpen && reservationId) {
      loadReservation();
      // Non scrollare la pagina - il drawer si centrerà automaticamente nella viewport
    }
  }, [isOpen, reservationId]);

  // Scroll drawer body to top SOLO quando cambia la prenotazione
  useEffect(() => {
    if (drawerBodyRef.current && reservationId) {
      requestAnimationFrame(() => {
        if (drawerBodyRef.current) {
          drawerBodyRef.current.scrollTop = 0;
        }
      });
    }
  }, [reservationId]); // Solo quando cambia ID, non isOpen

  // Calcolo automatico numero persone quando cambiano le camere
  useEffect(() => {
    if (formData.roomNumbers && formData.roomNumbers.length > 0) {
      const total = formData.roomNumbers.reduce((acc, roomNumber) => {
        const roomType = ROOM_TYPES[roomNumber];
        const capacity = ROOM_CAPACITIES[roomType] || 0;
        return acc + capacity;
      }, 0);
      if (total !== formData.totalPeople) {
        setFormData(prev => ({ ...prev, totalPeople: total }));
      }
    }
  }, [formData.roomNumbers]);

  const loadReservation = async () => {
    setLoading(true);
    setError('');
    try {
      const reservationRef = doc(db, 'reservations', reservationId);
      const reservationSnap = await getDoc(reservationRef);
      
      if (reservationSnap.exists()) {
        const data = { id: reservationSnap.id, ...reservationSnap.data() };
        setReservation(data);
        setFormData({
          isGroup: data.isGroup || false,
          agencyGroupName: data.agencyGroupName || '',
          guestName: data.guestName || '',
          phoneNumber: data.phoneNumber || '',
          price: data.price || 0,
          deposit: data.deposit || 0,
          status: data.status || 'in_attesa',
          guestsArrived: data.guestsArrived || {},
          additionalNotes: data.additionalNotes || '',
          checkInDate: data.checkInDate ? format(data.checkInDate.toDate(), 'yyyy-MM-dd') : '',
          checkOutDate: data.checkOutDate ? format(data.checkOutDate.toDate(), 'yyyy-MM-dd') : '',
          paymentCompleted: data.paymentCompleted || false,
          totalPeople: data.totalPeople || 0,
          priceWithoutExtras: data.priceWithoutExtras || 0,
          priceWithExtras: data.priceWithExtras || 0,
          // Campi per multiple camere
          roomNumbers: data.roomNumbers || [],
          roomCustomNames: data.roomCustomNames || {},
          roomPrices: data.roomPrices || {},
          extraPerRoom: data.extraPerRoom || {},
          roomCribs: data.isGroup ? (data.roomCribs || {}) : !!data.roomCribs,
          customPrice: '',
        });
        
        // Carica conflitti stanze se ci sono date
        if (data.checkInDate && data.checkOutDate) {
          await loadConflictingReservations(data);
        }
      } else {
        setError('Prenotazione non trovata');
      }
    } catch (err) {
      console.error('Errore nel caricamento:', err);
      setError('Errore nel caricamento della prenotazione');
    } finally {
      setLoading(false);
    }
  };

  // Aggiungi rapidamente extras a una stanza (senza modalità modifica)
  const addQuickExtras = async (roomNum) => {
    if (!reservation) return;
    try {
      setLoading(true);
      const qe = quickExtras[roomNum] || {};
      const currentExtras = (reservation.extraPerRoom && reservation.extraPerRoom[roomNum]) || {};
      const newExtras = {
        ...currentExtras,
        extraBar: Number(currentExtras.extraBar || 0) + Number(qe.extraBar || 0),
        extraServizi: Number(currentExtras.extraServizi || 0) + Number(qe.extraServizi || 0),
        petAllowed: currentExtras.petAllowed || Boolean(qe.petAllowed),
      };

      const newExtraPerRoom = {
        ...(reservation.extraPerRoom || {}),
        [roomNum]: newExtras,
      };

      let newRoomCribs = reservation.roomCribs || {};
      if (qe.culla) {
        newRoomCribs = { ...newRoomCribs, [roomNum]: true };
      }

      const updatedReservation = {
        ...reservation,
        extraPerRoom: newExtraPerRoom,
        roomCribs: newRoomCribs,
      };
      const summary = summarizeReservationPricing(updatedReservation);

      const reservationRef = doc(db, 'reservations', reservationId);
      await updateDoc(reservationRef, {
        extraPerRoom: newExtraPerRoom,
        roomCribs: newRoomCribs,
        price: summary.calculatedTotal,
        priceWithExtras: summary.calculatedTotal,
        priceWithoutExtras: summary.base,
        updatedAt: Timestamp.now(),
      });

      // pulizia inputs
      setQuickExtras(prev => ({
        ...prev,
        [roomNum]: { extraBar: 0, extraServizi: 0, petAllowed: false, culla: false },
      }));

      await loadReservation();
      if (onUpdate) onUpdate();
      setSuccess('Extra aggiunti con successo');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Errore aggiunta extras:', err);
      setError('Errore durante l\'aggiunta degli extra');
    } finally {
      setLoading(false);
    }
  };

  // Aggiungi extras per prenotazione singola (senza mappa stanze)
  const addQuickExtrasSingle = async () => {
    if (!reservation) return;
    try {
      setLoading(true);
      const qe = quickExtras['single'] || {};
      const currentExtras = reservation.extraPerRoom || {};
      const newExtras = {
        ...currentExtras,
        extraBar: Number(currentExtras.extraBar || 0) + Number(qe.extraBar || 0),
        extraServizi: Number(currentExtras.extraServizi || 0) + Number(qe.extraServizi || 0),
        petAllowed: currentExtras.petAllowed || Boolean(qe.petAllowed),
      };

      let roomCribs = typeof reservation.roomCribs === 'boolean' ? reservation.roomCribs : false;
      if (qe.culla) roomCribs = true;

      const updatedReservation = {
        ...reservation,
        extraPerRoom: newExtras,
        roomCribs: roomCribs,
      };
      const summary = summarizeReservationPricing(updatedReservation);

      const reservationRef = doc(db, 'reservations', reservationId);
      await updateDoc(reservationRef, {
        extraPerRoom: newExtras,
        roomCribs: roomCribs,
        price: summary.calculatedTotal,
        priceWithExtras: summary.calculatedTotal,
        priceWithoutExtras: summary.base,
        updatedAt: Timestamp.now(),
      });

      setQuickExtras(prev => ({
        ...prev,
        single: { extraBar: 0, extraServizi: 0, petAllowed: false, culla: false },
      }));
      await loadReservation();
      if (onUpdate) onUpdate();
      setSuccess('Extra aggiunti con successo');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Errore aggiunta extras (singola):', err);
      setError('Errore durante l\'aggiunta degli extra');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
      const next = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      };

      if (name === 'priceWithExtras') {
        const numeric = N(value);
        if (prev.customPrice === undefined || prev.customPrice === '') {
          next.price = numeric;
        }
      }

      if (name === 'customPrice') {
        if (value === '') {
          next.price = N(next.priceWithExtras);
        } else {
          next.price = N(value);
        }
      }

      if (name === 'price') {
        next.customPrice = '';
      }

      return next;
    });
  };

  const editingDraft = useMemo(() => buildReservationDraftFromForm(formData), [formData]);
  const editingSummary = useMemo(() => summarizeReservationPricing(editingDraft), [editingDraft]);
  const customPriceValue = formData.customPrice !== undefined && formData.customPrice !== ''
    ? N(formData.customPrice)
    : null;
  const finalPricePreview = customPriceValue !== null
    ? customPriceValue
    : (N(formData.price) > 0 ? N(formData.price) : editingSummary.calculatedTotal);
  const amountDuePreview = Math.max(0, finalPricePreview - N(formData.deposit));

  const switchEditToSingle = () => {
    setFormData(prev => ({
      ...prev,
      isGroup: false,
      extraPerRoom: {
        extraBar: N(prev.extraPerRoom?.extraBar),
        extraServizi: N(prev.extraPerRoom?.extraServizi),
        petAllowed: !!prev.extraPerRoom?.petAllowed,
      },
      roomCribs: false,
    }));
  };

  const switchEditToGroup = () => {
    setFormData(prev => {
      const extras = {};
      const cribs = {};
      (prev.roomNumbers || []).forEach((room) => {
        const roomKey = Number(room);
        const existing = prev.extraPerRoom?.[roomKey] || prev.extraPerRoom?.[room] || {};
        extras[roomKey] = {
          extraBar: N(existing.extraBar),
          extraServizi: N(existing.extraServizi),
          petAllowed: !!existing.petAllowed,
        };
        cribs[roomKey] = !!(prev.roomCribs && prev.roomCribs[roomKey]);
      });
      return {
        ...prev,
        isGroup: true,
        extraPerRoom: extras,
        roomCribs: cribs,
      };
    });
  };

  const loadConflictingReservations = async (currentReservation) => {
    try {
      const reservationsRef = collection(db, 'reservations');
      const snapshot = await getDocs(reservationsRef);
      
      const checkInDate = currentReservation.checkInDate.toDate();
      const checkOutDate = currentReservation.checkOutDate.toDate();
      
      // Mappa: camera -> array di prenotazioni che la occupano
      const roomOccupancy = {};
      
      snapshot.docs.forEach((docSnap) => {
        const otherReservation = { id: docSnap.id, ...docSnap.data() };
        
        // Skip se è la stessa prenotazione o se è annullata
        if (otherReservation.id === currentReservation.id || 
            otherReservation.status === 'annullata') {
          return;
        }
        
        const otherCheckIn = otherReservation.checkInDate.toDate();
        const otherCheckOut = otherReservation.checkOutDate.toDate();
        
        // Verifica sovrapposizione date
        const datesOverlap = (
          (checkInDate >= otherCheckIn && checkInDate < otherCheckOut) ||
          (checkOutDate > otherCheckIn && checkOutDate <= otherCheckOut) ||
          (checkInDate <= otherCheckIn && checkOutDate >= otherCheckOut)
        );
        
        if (datesOverlap) {
          // Ottieni le stanze di questa prenotazione
          const otherRooms = Array.isArray(otherReservation.roomNumbers)
            ? otherReservation.roomNumbers
            : [otherReservation.roomNumber];
          
          // Aggiungi questa prenotazione a ogni camera che occupa
          otherRooms.forEach(room => {
            if (!roomOccupancy[room]) {
              roomOccupancy[room] = [];
            }
            roomOccupancy[room].push({
              ...otherReservation,
              checkInDate: otherCheckIn,
              checkOutDate: otherCheckOut,
            });
          });
        }
      });
      
      setConflictingReservations(roomOccupancy);
    } catch (err) {
      console.error('Errore nel caricamento occupazione stanze:', err);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const draftForPricing = buildReservationDraftFromForm(formData);
      const recommendedSummary = summarizeReservationPricing(draftForPricing);
      const customPrice = formData.customPrice !== undefined && formData.customPrice !== ''
        ? N(formData.customPrice)
        : null;
      const priceFromForm = N(formData.price);
      const priceToSave = customPrice !== null
        ? customPrice
        : (priceFromForm > 0 ? priceFromForm : recommendedSummary.calculatedTotal);
      const finalSummary = summarizeReservationPricing({ ...draftForPricing, price: priceToSave });

      const updateData = {
        isGroup: formData.isGroup || false,
        agencyGroupName: formData.isGroup ? (formData.agencyGroupName || '') : '',
        guestName: formData.isGroup ? formData.agencyGroupName : formData.guestName,
        phoneNumber: formData.phoneNumber,
        price: priceToSave,
        priceWithoutExtras: finalSummary.base,
        priceWithExtras: finalSummary.calculatedTotal,
        deposit: finalSummary.deposit,
        status: formData.status,
        guestsArrived: formData.guestsArrived,
        additionalNotes: formData.additionalNotes,
        paymentCompleted: formData.paymentCompleted,
        totalPeople: Number(formData.totalPeople) || 0,
        updatedAt: Timestamp.now(),
      };
      
      // Se le date sono state modificate, aggiornale
      if (formData.checkInDate && formData.checkOutDate) {
        updateData.checkInDate = Timestamp.fromDate(new Date(formData.checkInDate));
        updateData.checkOutDate = Timestamp.fromDate(new Date(formData.checkOutDate));
      }
      
      // Salva dati camere se presenti
      if (formData.roomNumbers && formData.roomNumbers.length > 0) {
        updateData.roomNumbers = formData.roomNumbers;
        updateData.roomCustomNames = formData.roomCustomNames || {};
        updateData.roomPrices = formData.roomPrices || {};
        updateData.extraPerRoom = formData.extraPerRoom || {};
        updateData.roomCribs = formData.isGroup ? (formData.roomCribs || {}) : !!formData.roomCribs;
      }

      const reservationRef = doc(db, 'reservations', reservationId);
      await updateDoc(reservationRef, updateData);
      
      setSuccess('Prenotazione aggiornata con successo!');
      setIsEditing(false);
      
      // Ricarica i dati
      await loadReservation();
      
      // Notifica il parent component
      if (onUpdate) {
        onUpdate();
      }
      
      // Auto-chiudi dopo 2 secondi
      setTimeout(() => {
        setSuccess('');
      }, 2000);
    } catch (err) {
      console.error('Errore nel salvataggio:', err);
      setError('Errore nel salvataggio della prenotazione');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsEditing(false);
    setError('');
    setSuccess('');
    
    // NON resettare scroll - mantieni posizione per riapertura
    
    onClose();
  };

  const getStatusInfo = (status) => {
    const statuses = {
      in_attesa: { label: 'In Attesa', color: '#f59e0b', className: 'warning' },
      confermata: { label: 'Confermata', color: '#22c55e', className: 'success' },
      annullata: { label: 'Annullata', color: '#ef4444', className: 'danger' },
      conclusa: { label: 'Conclusa', color: '#64748b', className: 'info' },
    };
    return statuses[status] || statuses.in_attesa;
  };

  if (!isOpen) return null;

  // Pricing summary (always derived from reservation data)
  const pricing = reservation ? summarizeReservationPricing(reservation) : null;

  // Usa Portal per renderizzare il drawer direttamente nel body, bypassando backdrop-filter
  return createPortal(
    <>
      <div 
        className="drawer-overlay" 
        onClick={handleClose}
      >
        <div 
          className="drawer-content" 
          onClick={(e) => e.stopPropagation()}
        >
        <div className="drawer-header">
          <h2 className="drawer-title">
            {isEditing ? 'Modifica Prenotazione' : 'Dettagli Prenotazione'}
          </h2>
          <button className="modal-close" onClick={handleClose} aria-label="Chiudi">
            ✕
          </button>
        </div>

        <div className="drawer-body" ref={drawerBodyRef}>
          {loading && !reservation && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="loading-spinner" style={{ margin: '0 auto' }} />
              <p style={{ marginTop: '1rem', color: 'rgba(15, 23, 42, 0.5)' }}>
                Caricamento...
              </p>
            </div>
          )}

          {error && (
            <div className="error-message" style={{ marginBottom: '1rem' }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="success-message" style={{ marginBottom: '1rem' }}>
              <span>✓</span>
              <span>{success}</span>
            </div>
          )}

          {reservation && !isEditing && (
            <div className="form-container">
              {/* Cambio Stato Rapido */}
              <div className="panel" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)', border: '2px solid rgba(37, 99, 235, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'rgba(15, 23, 42, 0.75)', display: 'block', marginBottom: '0.5rem' }}>
                      🔄 Cambio Stato Rapido
                    </label>
                    <select
                      value={reservation.status}
                      onChange={async (e) => {
                        const newStatus = e.target.value;
                        
                        // Se stato = conclusa, chiedi conferma per generare fattura
                        if (newStatus === 'conclusa' && !reservation.invoiceNumber) {
                          const confirm = window.confirm(
                            '🏁 Vuoi completare il checkout e generare la fattura?\n\n' +
                            'Questo cambierà lo stato a "Conclusa" e genererà automaticamente la fattura.'
                          );
                          if (!confirm) return;
                        }
                        
                        try {
                          setLoading(true);
                          
                          // Se stato = conclusa e non ha già una fattura, genera fattura
                          if (newStatus === 'conclusa' && !reservation.invoiceNumber) {
                            // Import dinamico delle utility (jspdf-autotable è già nel file utility)
                            const { downloadInvoicePDF, generateInvoiceNumber } = await import('../utils/invoiceGenerator');
                            
                            // 1. Ottieni numero fattura progressivo
                            const invoicesRef = collection(db, 'invoices');
                            const q = query(invoicesRef, orderBy('createdAt', 'desc'), limit(1));
                            const snapshot = await getDocs(q);
                            const lastInvoiceCount = snapshot.empty ? 0 : (snapshot.docs[0].data().invoiceCount || 0);
                            const newInvoiceCount = lastInvoiceCount + 1;
                            const invoiceNumber = generateInvoiceNumber(newInvoiceCount);

                            // 2. Calcola totali (centralizzato)
                            const summary = summarizeReservationPricing(reservation);
                            const finalTotal = summary.includesExtras ? summary.savedPrice : summary.calculatedTotal;
                            const totalAmount = Math.max(0, finalTotal - summary.deposit);

                            // 3. Salva fattura in Firestore
                            const invoiceData = {
                              invoiceNumber,
                              invoiceCount: newInvoiceCount,
                              reservationId: reservationId,
                              guestName: reservation.guestName,
                              phoneNumber: reservation.phoneNumber || '',
                              checkInDate: reservation.checkInDate,
                              checkOutDate: reservation.checkOutDate,
                              roomNumbers: reservation.roomNumbers || [reservation.roomNumber],
                              price: summary.savedPrice,
                              totalExtras: summary.extrasTotal,
                              deposit: summary.deposit,
                              totalAmount,
                              status: 'paid',
                              createdAt: Timestamp.now(),
                              reservationData: { ...reservation },
                            };

                            await addDoc(invoicesRef, invoiceData);

                            // 4. Aggiorna prenotazione con stato e numero fattura
                            const reservationRef = doc(db, 'reservations', reservationId);
                            await updateDoc(reservationRef, {
                              status: newStatus,
                              paymentCompleted: true,
                              invoiceNumber,
                            });

                            // 5. Genera e scarica PDF
                            downloadInvoicePDF(reservation, invoiceNumber);

                            setSuccess(`✅ Checkout completato! Fattura ${invoiceNumber} generata.`);
                          } else {
                            // Cambio stato normale senza fattura
                            const reservationRef = doc(db, 'reservations', reservationId);
                            await updateDoc(reservationRef, { status: newStatus });
                            setSuccess(`Stato aggiornato a: ${getStatusInfo(newStatus).label}`);
                          }
                          
                          setTimeout(() => setSuccess(''), 5000);
                          loadReservation();
                        } catch (err) {
                          setError('Errore aggiornamento stato: ' + err.message);
                          console.error(err);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      style={{
                        padding: '0.65rem 1rem',
                        fontSize: '0.95rem',
                        fontWeight: '500',
                        border: '2px solid rgba(37, 99, 235, 0.3)',
                        borderRadius: 'var(--radius-md)',
                        background: 'white',
                        cursor: 'pointer',
                        minWidth: '200px',
                      }}
                    >
                      <option value="in_attesa">⏳ In Attesa</option>
                      <option value="confermata">✅ Confermata</option>
                      <option value="conclusa">🏁 Conclusa</option>
                      <option value="annullata">❌ Annullata</option>
                    </select>
                  </div>
                  <span className={`status-badge status-badge--${getStatusInfo(reservation.status).className}`} style={{ fontSize: '1rem', padding: '0.65rem 1.25rem' }}>
                    <span className="status-dot" style={{ background: getStatusInfo(reservation.status).color, width: '10px', height: '10px' }} />
                    {getStatusInfo(reservation.status).label}
                  </span>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h3 className="panel-title">Informazioni Ospite</h3>
                </div>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.65)' }}>Nome:</strong>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '1rem', fontWeight: '500' }}>
                      {reservation.guestName}
                    </p>
                  </div>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.65)' }}>Telefono:</strong>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '1rem' }}>
                      {reservation.phoneNumber}
                    </p>
                  </div>
                  {reservation.isGroup && reservation.agencyGroupName && (
                    <div style={{ padding: '0.75rem', background: 'rgba(238, 130, 238, 0.1)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(238, 130, 238, 0.3)' }}>
                      <strong style={{ fontSize: '0.85rem', color: '#9333ea' }}>👥 Gruppo/Agenzia:</strong>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '1rem', fontWeight: '600', color: '#9333ea' }}>
                        {reservation.agencyGroupName}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="panel">
                <h3 className="panel-title">Date e Stanze</h3>
                <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.65)' }}>Check-in:</strong>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '1rem' }}>
                      {reservation.checkInDate 
                        ? format(reservation.checkInDate.toDate(), 'dd MMMM yyyy', { locale: it })
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.65)' }}>Check-out:</strong>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '1rem' }}>
                      {reservation.checkOutDate 
                        ? format(reservation.checkOutDate.toDate(), 'dd MMMM yyyy', { locale: it })
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.65)' }}>Stanza/e:</strong>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '1rem' }}>
                      {Array.isArray(reservation.roomNumbers) 
                        ? reservation.roomNumbers.join(', ')
                        : reservation.roomNumber || 'N/A'}
                    </p>
                  </div>
                  {reservation.isGroup && reservation.roomCustomNames && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <strong style={{ fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.65)' }}>Nominativi per Stanza:</strong>
                      <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.5rem', display: 'grid', gap: '0.35rem' }}>
                        {Object.entries(reservation.roomCustomNames).map(([room, name]) => (
                          <li key={room} style={{ fontSize: '0.9rem' }}>
                            <strong>Camera {room}:</strong> {name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {reservation.totalPeople && (
                    <div>
                      <strong style={{ fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.65)' }}>Persone Totali:</strong>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '1rem' }}>
                        {reservation.totalPeople}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="panel">
                <h3 className="panel-title">Dettagli Economici</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '1rem' }}>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.65)' }}>Prezzo Base</strong>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '1.1rem' }}>€ {pricing ? pricing.base.toFixed(2) : '0.00'}</p>
                  </div>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.65)' }}>Extras</strong>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '1.1rem' }}>€ {pricing ? pricing.extrasTotal.toFixed(2) : '0.00'}</p>
                  </div>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.65)' }}>Totale Calcolato</strong>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '1.1rem', fontWeight: 600 }}>€ {pricing ? pricing.calculatedTotal.toFixed(2) : '0.00'}</p>
                  </div>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.65)' }}>Prezzo Salvato</strong>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '1.1rem', fontWeight: 600, color: '#15294F' }}>€ {pricing ? pricing.savedPrice.toFixed(2) : '0.00'}</p>
                  </div>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.65)' }}>Caparra</strong>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '1.1rem', color: '#22c55e', fontWeight: 600 }}>€ {pricing ? pricing.deposit.toFixed(2) : '0.00'}</p>
                  </div>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.65)' }}>Da Pagare</strong>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '1.2rem', fontWeight: 700 }}>
                      € {pricing ? (pricing.includesExtras ? pricing.dueUsingSaved : pricing.dueUsingCalculated).toFixed(2) : '0.00'}
                    </p>
                    {pricing && (
                      <small style={{ color: 'rgba(15,23,42,.6)' }}>
                        {pricing.includesExtras ? 'Interpretazione: Prezzo salvato include gli extra' : 'Interpretazione: Prezzo salvato NON include gli extra'}
                      </small>
                    )}
                  </div>
                </div>
                {pricing && Math.abs(pricing.savedPrice - pricing.calculatedTotal) > 0.01 && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '.9rem', color: '#7c3aed' }}>
                      Differenza: € {(pricing.savedPrice - pricing.calculatedTotal).toFixed(2)}
                    </span>
                    <button
                      className="btn btn-sm btn--primary"
                      onClick={async () => {
                        try {
                          setLoading(true);
                          const reservationRef = doc(db, 'reservations', reservation.id);
                          await updateDoc(reservationRef, {
                            price: pricing.calculatedTotal,
                            priceWithExtras: pricing.calculatedTotal,
                            priceWithoutExtras: pricing.base,
                            updatedAt: Timestamp.now(),
                          });
                          await loadReservation();
                          setSuccess('Prezzo allineato al totale calcolato');
                          setTimeout(() => setSuccess(''), 2000);
                        } catch (err) {
                          console.error(err);
                          setError('Errore durante l\'allineamento del prezzo');
                        } finally { setLoading(false); }
                      }}
                    >
                      Allinea Prezzo Salvato
                    </button>
                  </div>
                )}
                {/* Aggiungi Extra Rapido per prenotazione singola */}
                {!reservation.isGroup && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(226, 232, 240, 0.8)', paddingTop: '1rem' }}>
                    <strong style={{ fontSize: '0.9rem', color: 'rgba(15, 23, 42, 0.75)' }}>Aggiungi Extra:</strong>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>+ Extra Bar (€)</label>
                        <input
                          type="number"
                          value={(quickExtras['single']?.extraBar) ?? ''}
                          onChange={(e) => setQuickExtras(prev => ({
                            ...prev,
                            single: { ...prev.single, extraBar: Number(e.target.value) }
                          }))}
                          min="0"
                          step="0.01"
                          placeholder="0"
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>+ Extra Servizi (€)</label>
                        <input
                          type="number"
                          value={(quickExtras['single']?.extraServizi) ?? ''}
                          onChange={(e) => setQuickExtras(prev => ({
                            ...prev,
                            single: { ...prev.single, extraServizi: Number(e.target.value) }
                          }))}
                          min="0"
                          step="0.01"
                          placeholder="0"
                          style={{ width: '100%' }}
                        />
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(quickExtras['single']?.petAllowed)}
                          onChange={(e) => setQuickExtras(prev => ({
                            ...prev,
                            single: { ...prev.single, petAllowed: e.target.checked }
                          }))}
                          style={{ width: '1rem', height: '1rem' }}
                        />
                        <span style={{ fontSize: '0.85rem' }}>🐾 Pet (+10€)</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(quickExtras['single']?.culla)}
                          onChange={(e) => setQuickExtras(prev => ({
                            ...prev,
                            single: { ...prev.single, culla: e.target.checked }
                          }))}
                          style={{ width: '1rem', height: '1rem' }}
                        />
                        <span style={{ fontSize: '0.85rem' }}>👶 Culla (+10€)</span>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn--primary"
                          onClick={addQuickExtrasSingle}
                          disabled={loading}
                        >
                          ➕ Aggiungi
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {reservation.isGroup && reservation.extraPerRoom && Array.isArray(reservation.roomNumbers) && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(226, 232, 240, 0.8)', paddingTop: '1rem' }}>
                    <strong style={{ fontSize: '0.9rem', color: 'rgba(15, 23, 42, 0.75)' }}>Extras per Stanza:</strong>
                    <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}>
                      {reservation.roomNumbers.map((room) => {
                        const extras = reservation.extraPerRoom[room] || {};
                        const roomPrice = reservation.roomPrices?.[room] || 0;
                        return (
                          <div key={room} style={{ padding: '0.75rem', background: 'rgba(241, 245, 249, 0.6)', borderRadius: 'var(--radius-sm)' }}>
                            <strong style={{ fontSize: '0.85rem' }}>Camera {room}</strong>
                            <div style={{ fontSize: '0.8rem', marginTop: '0.35rem', display: 'grid', gap: '0.25rem' }}>
                              <span>Prezzo/notte: €{roomPrice}</span>
                              {extras.extraBar > 0 && <span>Extra Bar: €{extras.extraBar}</span>}
                              {extras.extraServizi > 0 && <span>Extra Servizi: €{extras.extraServizi}</span>}
                              {extras.petAllowed && <span>🐾 Pet Allowed (+10€)</span>}
                              {reservation.roomCribs?.[room] && <span>👶 Culla (+10€)</span>}
                            </div>

                            {/* Aggiungi Extra Rapido (senza entrare in Modifica) */}
                            <div style={{
                              marginTop: '0.5rem',
                              paddingTop: '0.5rem',
                              borderTop: '1px dashed rgba(226, 232, 240, 0.8)',
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                              gap: '0.5rem'
                            }}>
                              <div>
                                <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>+ Extra Bar (€)</label>
                                <input
                                  type="number"
                                  value={(quickExtras[room]?.extraBar) ?? ''}
                                  onChange={(e) => setQuickExtras(prev => ({
                                    ...prev,
                                    [room]: { ...prev[room], extraBar: Number(e.target.value) }
                                  }))}
                                  min="0"
                                  step="0.01"
                                  placeholder="0"
                                  style={{ width: '100%' }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>+ Extra Servizi (€)</label>
                                <input
                                  type="number"
                                  value={(quickExtras[room]?.extraServizi) ?? ''}
                                  onChange={(e) => setQuickExtras(prev => ({
                                    ...prev,
                                    [room]: { ...prev[room], extraServizi: Number(e.target.value) }
                                  }))}
                                  min="0"
                                  step="0.01"
                                  placeholder="0"
                                  style={{ width: '100%' }}
                                />
                              </div>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(quickExtras[room]?.petAllowed)}
                                  onChange={(e) => setQuickExtras(prev => ({
                                    ...prev,
                                    [room]: { ...prev[room], petAllowed: e.target.checked }
                                  }))}
                                  style={{ width: '1rem', height: '1rem' }}
                                />
                                <span style={{ fontSize: '0.85rem' }}>🐾 Pet (+10€)</span>
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(quickExtras[room]?.culla)}
                                  onChange={(e) => setQuickExtras(prev => ({
                                    ...prev,
                                    [room]: { ...prev[room], culla: e.target.checked }
                                  }))}
                                  style={{ width: '1rem', height: '1rem' }}
                                />
                                <span style={{ fontSize: '0.85rem' }}>👶 Culla (+10€)</span>
                              </label>
                              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                <button
                                  type="button"
                                  className="btn btn-sm btn--primary"
                                  onClick={() => addQuickExtras(room)}
                                  disabled={loading}
                                >
                                  ➕ Aggiungi
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input
                    type="checkbox"
                    checked={reservation.guestsArrived || false}
                    onChange={async (e) => {
                      try {
                        const reservationRef = doc(db, 'reservations', reservationId);
                        await updateDoc(reservationRef, {
                          guestsArrived: e.target.checked,
                        });
                        await loadReservation();
                        if (onUpdate) onUpdate();
                      } catch (err) {
                        console.error('Errore:', err);
                      }
                    }}
                    style={{ width: '1.25rem', height: '1.25rem' }}
                  />
                  <label style={{ fontSize: '1rem', fontWeight: '500', cursor: 'pointer' }}>
                    Ospiti arrivati
                  </label>
                </div>
                {reservation.additionalNotes && (
                  <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(251, 191, 36, 0.1)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                    <strong style={{ fontSize: '0.85rem', color: '#d97706' }}>📝 Note:</strong>
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', color: 'rgba(15, 23, 42, 0.75)', whiteSpace: 'pre-wrap' }}>
                      {reservation.additionalNotes}
                    </p>
                  </div>
                )}
              </div>

              {/* Sezione Altre Prenotazioni Sovrapposte (in visualizzazione) */}
              {Object.keys(conflictingReservations).length > 0 && (
                <div className="panel" style={{ marginTop: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem' }}>
                    🔗 Altre Prenotazioni nello Stesso Periodo
                  </h4>
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.65)' }}>
                    {Object.keys(conflictingReservations).length} {Object.keys(conflictingReservations).length === 1 ? 'camera occupata' : 'camere occupate'} dal {format(reservation.checkInDate.toDate(), 'dd/MM/yyyy')} al {format(reservation.checkOutDate.toDate(), 'dd/MM/yyyy')}
                  </p>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {Object.entries(conflictingReservations).map(([room, reservations]) => (
                      <div key={room} style={{ 
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(241, 245, 249, 0.6)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid rgba(226, 232, 240, 0.8)'
                      }}>
                        <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>Camera {room}:</strong>
                        <div style={{ marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {reservations.map((res, idx) => (
                            <a
                              key={idx}
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                onClose();
                                setTimeout(() => {
                                  window.dispatchEvent(new CustomEvent('openReservation', { 
                                    detail: { reservationId: res.id } 
                                  }));
                                }, 300);
                              }}
                              style={{
                                color: '#15294F',
                                textDecoration: 'underline',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                              }}
                            >
                              <span>→ {res.guestName}</span>
                              {res.isGroup && res.agencyGroupName && (
                                <span style={{ color: '#9333ea', fontWeight: '600' }}>
                                  ({res.agencyGroupName})
                                </span>
                              )}
                              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'rgba(15, 23, 42, 0.5)' }}>
                                {format(res.checkInDate, 'dd/MM')}→{format(res.checkOutDate, 'dd/MM')}
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {reservation && isEditing && (
            <div className="form-container">
              {/* Toggle Singola/Gruppo */}
              <div className="panel" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={!formData.isGroup}
                      onChange={switchEditToSingle}
                      style={{ width: '1.25rem', height: '1.25rem' }}
                    />
                    <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>Prenotazione Singola</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={formData.isGroup}
                      onChange={switchEditToGroup}
                      style={{ width: '1.25rem', height: '1.25rem' }}
                    />
                    <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>Prenotazione Multipla (Gruppo/Agenzia)</span>
                  </label>
                </div>
              </div>

              <div className="form-grid">
                {/* Nome condizionale: Ospite vs Agenzia */}
                {formData.isGroup ? (
                  <div className="form-field">
                    <label>Nome Agenzia/Gruppo</label>
                    <input
                      type="text"
                      name="agencyGroupName"
                      value={formData.agencyGroupName}
                      onChange={handleInputChange}
                      placeholder="Nome agenzia o gruppo"
                    />
                  </div>
                ) : (
                  <div className="form-field">
                    <label>Nome Ospite</label>
                    <input
                      type="text"
                      name="guestName"
                      value={formData.guestName}
                      onChange={handleInputChange}
                      placeholder="Nome completo"
                    />
                  </div>
                )}

                <div className="form-field">
                  <label>Telefono</label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    placeholder="+39 123 456 7890"
                  />
                </div>

                <div className="form-field">
                  <label>Check-in</label>
                  <input
                    type="date"
                    name="checkInDate"
                    value={formData.checkInDate}
                    onChange={async (e) => {
                      handleInputChange(e);
                      // Ricarica conflitti quando cambiano le date
                      if (formData.checkOutDate && e.target.value) {
                        const tempReservation = {
                          ...reservation,
                          checkInDate: Timestamp.fromDate(new Date(e.target.value)),
                          checkOutDate: Timestamp.fromDate(new Date(formData.checkOutDate))
                        };
                        await loadConflictingReservations(tempReservation);
                      }
                    }}
                  />
                </div>

                <div className="form-field">
                  <label>Check-out</label>
                  <input
                    type="date"
                    name="checkOutDate"
                    value={formData.checkOutDate}
                    onChange={async (e) => {
                      handleInputChange(e);
                      // Ricarica conflitti quando cambiano le date
                      if (formData.checkInDate && e.target.value) {
                        const tempReservation = {
                          ...reservation,
                          checkInDate: Timestamp.fromDate(new Date(formData.checkInDate)),
                          checkOutDate: Timestamp.fromDate(new Date(e.target.value))
                        };
                        await loadConflictingReservations(tempReservation);
                      }
                    }}
                  />
                </div>

                <div className="form-field">
                  <label>Prezzo Totale (€)</label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="form-field">
                  <label>Numero Totale Persone</label>
                  <input
                    type="number"
                    value={formData.totalPeople}
                    readOnly
                    style={{ background: 'rgba(226, 232, 240, 0.3)', cursor: 'not-allowed' }}
                    title="Calcolato automaticamente in base alle camere selezionate"
                  />
                  <small style={{ fontSize: '0.8rem', color: 'rgba(15, 23, 42, 0.65)' }}>
                    Calcolato automaticamente
                  </small>
                </div>

                <div className="form-field">
                  <label>Stato</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                  >
                    <option value="in_attesa">In Attesa</option>
                    <option value="confermata">Confermata</option>
                    <option value="annullata">Annullata</option>
                    <option value="conclusa">Conclusa</option>
                  </select>
                </div>

                <div className="form-field">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      name="paymentCompleted"
                      checked={formData.paymentCompleted}
                      onChange={handleInputChange}
                      style={{ width: '1.25rem', height: '1.25rem' }}
                    />
                    Pagamento completato
                  </label>
                </div>

                {/* Sezione Prezzi */}
                <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                  <div className="panel" style={{ padding: '1.25rem', background: 'rgba(241, 245, 249, 0.55)' }}>
                    <h4 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: '600', color: '#15294F' }}>
                      💰 Prezzi &amp; Extra
                    </h4>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.7)' }}>
                      <span><strong>Notte/i:</strong> {editingSummary.nights}</span>
                      <span><strong>Camere:</strong> {formData.roomNumbers.length || 1}</span>
                      <span><strong>Prezzo salvato attuale:</strong> € {N(formData.price).toFixed(2)}</span>
                    </div>

                    {formData.isGroup ? (
                      <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.7)', background: 'rgba(226, 232, 240, 0.5)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                        Il prezzo base deriva dalla somma dei prezzi per notte inseriti nella sezione Camere.
                        Modifica quelle cifre per aggiornare il totale.
                      </div>
                    ) : (
                      <div style={{ marginTop: '0.75rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '500', display: 'block', marginBottom: '0.35rem' }}>
                          Prezzo Base (totale soggiorno, senza extra)
                        </label>
                        <input
                          type="number"
                          name="priceWithoutExtras"
                          value={formData.priceWithoutExtras}
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                          placeholder="Es. 220"
                          style={{ width: '100%' }}
                        />
                      </div>
                    )}

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '1rem',
                      marginTop: '1rem'
                    }}>
                      <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: '500', display: 'block', marginBottom: '0.35rem', color: '#7c3aed' }}>
                          Prezzo Totale Personalizzato (override)
                        </label>
                        <input
                          type="number"
                          name="customPrice"
                          value={formData.customPrice}
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                          placeholder="Lascia vuoto per mantenere il prezzo salvato"
                          style={{ width: '100%' }}
                        />
                        <small style={{ fontSize: '0.75rem', color: 'rgba(15, 23, 42, 0.6)', display: 'block', marginTop: '0.3rem' }}>
                          Inserisci un nuovo importo totale (sconto/prezzo fisso) oppure lascia vuoto.
                        </small>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: '500', display: 'block', marginBottom: '0.35rem' }}>
                          Caparra (€)
                        </label>
                        <input
                          type="number"
                          name="deposit"
                          value={formData.deposit}
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                          placeholder="Es. 50"
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>

                    <div style={{
                      marginTop: '1.25rem',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '0.75rem'
                    }}>
                      <div style={{ padding: '0.75rem', background: '#fff', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(226, 232, 240, 0.8)' }}>
                        <strong style={{ fontSize: '0.85rem', color: '#15294F' }}>Prezzo Base</strong>
                        <p style={{ margin: '0.35rem 0 0', fontSize: '1rem' }}>€ {editingSummary.base.toFixed(2)}</p>
                      </div>
                      <div style={{ padding: '0.75rem', background: '#fff', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(226, 232, 240, 0.8)' }}>
                        <strong style={{ fontSize: '0.85rem', color: '#15294F' }}>Extras</strong>
                        <p style={{ margin: '0.35rem 0 0', fontSize: '1rem' }}>€ {editingSummary.extrasTotal.toFixed(2)}</p>
                      </div>
                      <div style={{ padding: '0.75rem', background: '#fff', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(226, 232, 240, 0.8)' }}>
                        <strong style={{ fontSize: '0.85rem', color: '#15294F' }}>Totale Calcolato</strong>
                        <p style={{ margin: '0.35rem 0 0', fontSize: '1rem', fontWeight: 600 }}>€ {editingSummary.calculatedTotal.toFixed(2)}</p>
                      </div>
                      <div style={{ padding: '0.75rem', background: '#fff', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(226, 232, 240, 0.8)' }}>
                        <strong style={{ fontSize: '0.85rem', color: '#15294F' }}>Prezzo Finale che verrà salvato</strong>
                        <p style={{ margin: '0.35rem 0 0', fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>€ {finalPricePreview.toFixed(2)}</p>
                      </div>
                      <div style={{ padding: '0.75rem', background: '#fff', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(226, 232, 240, 0.8)' }}>
                        <strong style={{ fontSize: '0.85rem', color: '#15294F' }}>Caparra</strong>
                        <p style={{ margin: '0.35rem 0 0', fontSize: '1rem', fontWeight: 600, color: '#16a34a' }}>€ {N(formData.deposit).toFixed(2)}</p>
                      </div>
                      <div style={{ padding: '0.75rem', background: '#fff', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(226, 232, 240, 0.8)' }}>
                        <strong style={{ fontSize: '0.85rem', color: '#15294F' }}>Da incassare</strong>
                        <p style={{ margin: '0.35rem 0 0', fontSize: '1.05rem', fontWeight: 700 }}>€ {amountDuePreview.toFixed(2)}</p>
                      </div>
                    </div>

                    {Math.abs(finalPricePreview - editingSummary.calculatedTotal) > 0.01 && (
                      <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(124, 58, 237, 0.08)', border: '1px solid rgba(124, 58, 237, 0.25)', color: '#5b21b6', fontSize: '0.85rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                        <span>Diff. rispetto al totale calcolato: € {(finalPricePreview - editingSummary.calculatedTotal).toFixed(2)}</span>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => setFormData(prev => ({ ...prev, customPrice: '', price: editingSummary.calculatedTotal.toFixed(2) }))}
                        >
                          Usa Totale Calcolato
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                  <label>Note Aggiuntive</label>
                  <textarea
                    name="additionalNotes"
                    value={formData.additionalNotes}
                    onChange={handleInputChange}
                    rows="3"
                    placeholder="Aggiungi note o richieste speciali..."
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* Dettagli per Camera Prenotata */}
              {reservation.roomNumbers && Array.isArray(reservation.roomNumbers) && reservation.roomNumbers.length > 0 && (
                <div className="panel" style={{ marginTop: '1.5rem' }}>
                  <h3 className="panel-title">📋 Dettagli per Camera</h3>
                  <p style={{ fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.65)', marginTop: '0.5rem' }}>
                    Gestisci nominativi, extras e prezzi per ogni camera
                  </p>
                  
                  <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
                    {reservation.roomNumbers.map((roomNum) => (
                      <div 
                        key={roomNum}
                        style={{
                          padding: '1rem',
                          background: 'rgba(241, 245, 249, 0.5)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid rgba(226, 232, 240, 0.8)'
                        }}
                      >
                        <h4 style={{ 
                          margin: '0 0 0.75rem', 
                          fontSize: '0.95rem', 
                          fontWeight: '600',
                          color: '#15294F' 
                        }}>
                          🚪 Camera {roomNum}
                        </h4>
                        
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                          {/* Nominativo Camera */}
                          <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: '500', display: 'block', marginBottom: '0.35rem' }}>
                              Nominativo
                            </label>
                            <input
                              type="text"
                              value={formData.roomCustomNames?.[roomNum] || ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                roomCustomNames: {
                                  ...prev.roomCustomNames,
                                  [roomNum]: e.target.value
                                }
                              }))}
                              placeholder="Nome ospite per questa camera"
                              style={{ width: '100%' }}
                            />
                          </div>

                          {/* Prezzo Camera */}
                          <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: '500', display: 'block', marginBottom: '0.35rem' }}>
                              Prezzo Camera (€)
                            </label>
                            <input
                              type="number"
                              value={formData.roomPrices?.[roomNum] || 0}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                roomPrices: {
                                  ...prev.roomPrices,
                                  [roomNum]: Number(e.target.value)
                                }
                              }))}
                              min="0"
                              step="0.01"
                              style={{ width: '100%' }}
                            />
                          </div>

                          {/* Extras */}
                          <div style={{ 
                            padding: '0.75rem', 
                            background: 'white', 
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid rgba(226, 232, 240, 0.6)'
                          }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                              🎁 Extras
                            </div>
                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={formData.extraPerRoom?.[roomNum]?.petAllowed || false}
                                  onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    extraPerRoom: {
                                      ...prev.extraPerRoom,
                                      [roomNum]: {
                                        ...prev.extraPerRoom?.[roomNum],
                                        petAllowed: e.target.checked
                                      }
                                    }
                                  }))}
                                  style={{ width: '1rem', height: '1rem' }}
                                />
                                <span style={{ fontSize: '0.875rem' }}>🐕 Pet (+10€)</span>
                              </label>

                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={formData.roomCribs?.[roomNum] || false}
                                  onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    roomCribs: {
                                      ...prev.roomCribs,
                                      [roomNum]: e.target.checked
                                    }
                                  }))}
                                  style={{ width: '1rem', height: '1rem' }}
                                />
                                <span style={{ fontSize: '0.875rem' }}>👶 Culla (+10€)</span>
                              </label>

                              <div>
                                <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>
                                  Extra Bar (€)
                                </label>
                                <input
                                  type="number"
                                  value={formData.extraPerRoom?.[roomNum]?.extraBar || 0}
                                  onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    extraPerRoom: {
                                      ...prev.extraPerRoom,
                                      [roomNum]: {
                                        ...prev.extraPerRoom?.[roomNum],
                                        extraBar: Number(e.target.value)
                                      }
                                    }
                                  }))}
                                  min="0"
                                  step="0.01"
                                  style={{ width: '100%' }}
                                />
                              </div>

                              <div>
                                <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>
                                  Extra Servizi (€)
                                </label>
                                <input
                                  type="number"
                                  value={formData.extraPerRoom?.[roomNum]?.extraServizi || 0}
                                  onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    extraPerRoom: {
                                      ...prev.extraPerRoom,
                                      [roomNum]: {
                                        ...prev.extraPerRoom?.[roomNum],
                                        extraServizi: Number(e.target.value)
                                      }
                                    }
                                  }))}
                                  min="0"
                                  step="0.01"
                                  style={{ width: '100%' }}
                                />
                              </div>

                              {/* Ospiti Arrivati per questa camera */}
                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '0.5rem' }}>
                                <input
                                  type="checkbox"
                                  checked={formData.guestsArrived?.[roomNum] || false}
                                  onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    guestsArrived: {
                                      ...prev.guestsArrived,
                                      [roomNum]: e.target.checked
                                    }
                                  }))}
                                  style={{ width: '1rem', height: '1rem' }}
                                />
                                <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>✅ Ospiti Arrivati</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sezione Camere Disponibili */}
              {formData.checkInDate && formData.checkOutDate && (
                <div style={{ marginTop: '1.5rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '600' }}>
                    Camere Disponibili:
                  </h4>
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.65)' }}>
                    Prenotazioni sovrapposte dal {format(new Date(formData.checkInDate), 'dd/MM/yyyy')} al {format(new Date(formData.checkOutDate), 'dd/MM/yyyy')}
                  </p>
                  
                  {/* Legenda colori */}
                  <div style={{ 
                    display: 'flex', 
                    gap: '1rem', 
                    marginBottom: '1rem',
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(241, 245, 249, 0.5)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#15294F' }} />
                      <span>Selezionata</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e' }} />
                      <span>Disponibile</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#dc2626' }} />
                      <span>Occupata</span>
                    </div>
                  </div>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                    gap: '0.75rem' 
                  }}>
                    {Array.from({ length: 16 }, (_, i) => i + 1).map((roomNum) => {
                      // Trova se questa camera è occupata nel periodo
                      const roomReservations = conflictingReservations[roomNum] || [];
                      const isBooked = roomReservations.length > 0;
                      
                      // Verifica se questa camera è selezionata per questa prenotazione
                      const isSelected = formData.roomNumbers && formData.roomNumbers.includes(roomNum);
                      
                      // Determina il tipo di camera
                      let roomType = '';
                      if ([1, 11].includes(roomNum)) roomType = 'Quadrupla';
                      else if ([2, 10, 15].includes(roomNum)) roomType = 'Tripla';
                      else if ([3, 6, 9, 14].includes(roomNum)) roomType = 'Matrimoniale/Doppia';
                      else if ([8, 12, 13, 16].includes(roomNum)) roomType = 'Matrimoniale';
                      else if ([4].includes(roomNum)) roomType = 'Matrimoniale';
                      else if ([5, 7].includes(roomNum)) roomType = 'Singola / Tripla';
                      
                      return (
                        <div
                          key={roomNum}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.35rem',
                            padding: '0.625rem 0.75rem',
                            background: isSelected 
                              ? 'rgba(219, 234, 254, 0.9)' // Blu per selezionata
                              : isBooked 
                                ? 'rgba(254, 242, 242, 0.8)' // Rosso per occupata
                                : 'rgba(240, 253, 244, 0.8)', // Verde per disponibile
                            borderRadius: 'var(--radius-sm)',
                            border: `2px solid ${
                              isSelected 
                                ? '#15294F' // Bordo blu per selezionata
                                : isBooked 
                                  ? 'rgba(239, 68, 68, 0.3)' // Rosso per occupata
                                  : 'rgba(34, 197, 94, 0.2)' // Verde per disponibile
                            }`,
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isBooked}
                              onChange={(e) => {
                                const newRoomNumbers = e.target.checked
                                  ? [...(formData.roomNumbers || []), roomNum]
                                  : (formData.roomNumbers || []).filter(r => r !== roomNum);
                                
                                setFormData(prev => ({
                                  ...prev,
                                  roomNumbers: newRoomNumbers.sort((a, b) => a - b)
                                }));
                              }}
                              style={{ 
                                width: '1rem', 
                                height: '1rem',
                                cursor: isBooked ? 'not-allowed' : 'pointer'
                              }}
                            />
                            <span
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: isSelected 
                                  ? '#15294F' // Blu per selezionata
                                  : isBooked 
                                    ? '#dc2626' // Rosso per occupata
                                    : '#22c55e', // Verde per disponibile
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ fontSize: '0.875rem', fontWeight: '500', flex: 1 }}>
                              Camera {roomNum}: {roomType}
                            </span>
                          </div>
                          
                          {/* Mostra le prenotazioni per questa camera */}
                          {roomReservations.map((res, idx) => (
                            <a
                              key={idx}
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                onClose();
                                setTimeout(() => {
                                  window.dispatchEvent(new CustomEvent('openReservation', { 
                                    detail: { reservationId: res.id } 
                                  }));
                                }, 300);
                              }}
                              title={`${res.guestName} - ${format(res.checkInDate, 'dd/MM')} → ${format(res.checkOutDate, 'dd/MM')}${res.isGroup ? ` (${res.agencyGroupName})` : ''}`}
                              style={{
                                color: '#15294F',
                                textDecoration: 'underline',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                paddingLeft: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                transition: 'color 0.2s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#1d4ed8';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = '#15294F';
                              }}
                            >
                              <span style={{ flexShrink: 0 }}>→</span>
                              <span style={{ 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis', 
                                whiteSpace: 'nowrap' 
                              }}>
                                {res.guestName}
                                {res.isGroup && res.agencyGroupName && (
                                  <span style={{ color: '#9333ea', fontWeight: '600', marginLeft: '0.25rem' }}>
                                    ({res.agencyGroupName})
                                  </span>
                                )}
                              </span>
                              <span style={{ 
                                fontSize: '0.7rem', 
                                color: 'rgba(15, 23, 42, 0.5)',
                                flexShrink: 0,
                                marginLeft: 'auto'
                              }}>
                                {format(res.checkInDate, 'dd/MM')}→{format(res.checkOutDate, 'dd/MM')}
                              </span>
                            </a>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                  
                  {Object.keys(conflictingReservations).length > 0 && (
                    <div style={{ 
                      marginTop: '1rem',
                      padding: '0.75rem',
                      background: 'rgba(59, 130, 246, 0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(59, 130, 246, 0.2)'
                    }}>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'rgba(15, 23, 42, 0.75)' }}>
                        <strong style={{ color: '#15294F' }}>ℹ️ {Object.keys(conflictingReservations).length} {Object.keys(conflictingReservations).length === 1 ? 'camera occupata' : 'camere occupate'}</strong>
                        {' '}nelle date selezionate. Click sui link blu per gestire le prenotazioni.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="drawer-footer">
          {!isEditing && reservation ? (
            <>
              <button className="btn btn--ghost" onClick={handleClose}>
                Chiudi
              </button>
              <button className="btn btn--primary" onClick={() => setIsEditing(true)}>
                Modifica
              </button>
            </>
          ) : isEditing && (
            <>
              <button 
                className="btn btn--ghost" 
                onClick={() => {
                  setIsEditing(false);
                  // Reset completo formData ai valori originali
                  setFormData({
                    isGroup: reservation.isGroup || false,
                    agencyGroupName: reservation.agencyGroupName || '',
                    guestName: reservation.guestName || '',
                    phoneNumber: reservation.phoneNumber || '',
                    price: reservation.price || 0,
                    priceWithoutExtras: reservation.priceWithoutExtras || 0,
                    priceWithExtras: reservation.priceWithExtras || 0,
                    deposit: reservation.deposit || 0,
                    status: reservation.status || 'in_attesa',
                    guestsArrived: reservation.guestsArrived || {},
                    totalPeople: reservation.totalPeople || 0,
                    additionalNotes: reservation.additionalNotes || '',
                    checkInDate: reservation.checkInDate ? format(reservation.checkInDate.toDate(), 'yyyy-MM-dd') : '',
                    checkOutDate: reservation.checkOutDate ? format(reservation.checkOutDate.toDate(), 'yyyy-MM-dd') : '',
                    paymentCompleted: reservation.paymentCompleted || false,
                    roomNumbers: reservation.roomNumbers || [],
                    roomCustomNames: reservation.roomCustomNames || {},
                    roomPrices: reservation.roomPrices || {},
                    extraPerRoom: reservation.extraPerRoom || {},
                    roomCribs: reservation.isGroup ? (reservation.roomCribs || {}) : !!reservation.roomCribs,
                    customPrice: '',
                  });
                }}
                disabled={loading}
              >
                Annulla
              </button>
              <button 
                className="btn btn--primary" 
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? 'Salvataggio...' : 'Salva Modifiche'}
              </button>
            </>
          )}
        </div>
        </div>
      </div>
    </>,
    document.body
  );
}

export default ReservationQuickView;
