// src/components/AddReservationDrawer.jsx

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { collection, addDoc, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { format, isWithinInterval } from 'date-fns';
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
 * Drawer per aggiungere nuove prenotazioni da qualsiasi pagina
 */
function AddReservationDrawer({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [conflictingReservations, setConflictingReservations] = useState({});
  
  // Ref per drawer body
  const drawerBodyRef = useRef(null);
  
  // Blocca scroll del body quando drawer è aperto
  useScrollLock(isOpen);

  // Scroll drawer body to top quando si apre
  useEffect(() => {
    if (isOpen) {
      // Non scrollare la pagina - il drawer si centrerà automaticamente nella viewport
      
      // Scroll drawer body to top
      if (drawerBodyRef.current) {
        requestAnimationFrame(() => {
          if (drawerBodyRef.current) {
            drawerBodyRef.current.scrollTop = 0;
          }
        });
      }
    }
  }, [isOpen]);
  
  const [formData, setFormData] = useState({
    isGroup: false,
    agencyGroupName: '',
    guestName: '',
    phoneNumber: '',
    checkInDate: '',
    checkOutDate: '',
    roomNumber: '',
    roomNumbers: [],
    roomCustomNames: {},
    roomPrices: {},
    price: 0,
    priceWithoutExtras: 0,
    priceWithExtras: 0,
    pricePerNight: '',
    customPrice: '',
    deposit: 0,
    status: 'in_attesa',
    additionalNotes: '',
    totalPeople: 0,
    paymentCompleted: false,
    extraPerRoom: {},
    roomCribs: false,
    guestsArrived: {},
  });

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

  // Carica conflitti quando cambiano le date
  useEffect(() => {
    if (formData.checkInDate && formData.checkOutDate) {
      loadConflictingReservations();
    }
  }, [formData.checkInDate, formData.checkOutDate]);

  // Carica prenotazioni in conflitto
  const loadConflictingReservations = async () => {
    if (!formData.checkInDate || !formData.checkOutDate) return;
    
    try {
      const reservationsRef = collection(db, 'reservations');
      const snapshot = await getDocs(reservationsRef);
      
      const checkInDate = new Date(formData.checkInDate);
      const checkOutDate = new Date(formData.checkOutDate);
      
      // Mappa: camera -> array di prenotazioni che la occupano
      const roomOccupancy = {};
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const resStart = data.checkInDate?.toDate();
        const resEnd = data.checkOutDate?.toDate();
        
        if (!resStart || !resEnd) return;
        
        // Check overlap
        const hasOverlap = resStart < checkOutDate && resEnd > checkInDate;
        
        if (hasOverlap) {
          const rooms = data.roomNumbers || [data.roomNumber];
          rooms.forEach(roomNum => {
            if (!roomOccupancy[roomNum]) {
              roomOccupancy[roomNum] = [];
            }
            roomOccupancy[roomNum].push({
              id: doc.id,
              guestName: data.guestName,
              checkInDate: resStart,
              checkOutDate: resEnd,
              isGroup: data.isGroup,
              agencyGroupName: data.agencyGroupName,
            });
          });
        }
      });
      
      setConflictingReservations(roomOccupancy);
    } catch (err) {
      console.error('Errore caricamento conflitti:', err);
    }
  };

  const pricingDraft = useMemo(() => buildReservationDraftFromForm(formData), [formData]);
  const pricingSummary = useMemo(() => summarizeReservationPricing(pricingDraft), [pricingDraft]);
  const customPriceValue = formData.customPrice !== undefined && formData.customPrice !== ''
    ? N(formData.customPrice)
    : null;
  const finalPricePreview = customPriceValue !== null
    ? customPriceValue
    : (N(formData.price) > 0 ? N(formData.price) : pricingSummary.calculatedTotal);
  const amountDuePreview = Math.max(0, finalPricePreview - N(formData.deposit));

  const switchToSingle = () => {
    setFormData(prev => ({
      ...prev,
      isGroup: false,
      extraPerRoom: {
        extraBar: N(prev.extraPerRoom?.extraBar),
        extraServizi: N(prev.extraPerRoom?.extraServizi),
        petAllowed: !!prev.extraPerRoom?.petAllowed,
      },
      roomCribs: false,
      roomPrices: prev.roomPrices || {},
      pricePerNight: prev.pricePerNight || '',
    }));
  };

  const switchToGroup = () => {
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
        pricePerNight: '',
      };
    });
  };

  const handleRecalculateTotals = () => {
    let base = pricingSummary.base;
    if (!formData.isGroup) {
      const nights = pricingSummary.nights || 0;
      const perNight = N(formData.pricePerNight);
      if (perNight > 0 && nights > 0) {
        base = perNight * nights;
      } else if (N(formData.priceWithoutExtras) > 0) {
        base = N(formData.priceWithoutExtras);
      }
    } else if (N(formData.priceWithoutExtras) > 0) {
      base = N(formData.priceWithoutExtras);
    }

    const extras = pricingSummary.extrasTotal;
    const baseRounded = Math.round(base * 100) / 100;
    const totalRounded = Math.round((base + extras) * 100) / 100;

    setFormData(prev => ({
      ...prev,
      priceWithoutExtras: baseRounded,
      priceWithExtras: totalRounded,
      price: prev.customPrice !== undefined && prev.customPrice !== '' ? prev.price : totalRounded,
    }));
  };

  const handleRoomSelection = (roomNum) => {
    const alreadySelected = formData.roomNumbers.includes(roomNum);
    setFormData(prev => {
      const isSelected = prev.roomNumbers.includes(roomNum);
      if (isSelected) {
        // Rimuovi camera
        const { [roomNum]: removed1, ...restCustomNames } = prev.roomCustomNames;
        const { [roomNum]: removed2, ...restPrices } = prev.roomPrices;
        const { [roomNum]: removed3, ...restExtras } = prev.extraPerRoom;
        const { [roomNum]: removed4, ...restCribs } = prev.roomCribs;
        const { [roomNum]: removed5, ...restArrived } = prev.guestsArrived;
        
        return {
          ...prev,
          roomNumbers: prev.roomNumbers.filter(r => r !== roomNum),
          roomCustomNames: restCustomNames,
          roomPrices: restPrices,
          extraPerRoom: restExtras,
          roomCribs: restCribs,
          guestsArrived: restArrived,
        };
      } else {
        // Aggiungi camera
        return {
          ...prev,
          roomNumbers: [...prev.roomNumbers, roomNum].sort((a, b) => a - b),
          roomCustomNames: { ...prev.roomCustomNames, [roomNum]: '' },
          roomPrices: { ...prev.roomPrices, [roomNum]: 0 },
          extraPerRoom: { 
            ...prev.extraPerRoom, 
            [roomNum]: { petAllowed: false, extraBar: 0, extraServizi: 0 } 
          },
          roomCribs: { ...prev.roomCribs, [roomNum]: false },
          guestsArrived: { ...prev.guestsArrived, [roomNum]: false },
        };
      }
    });

    if (!alreadySelected) {
      setTimeout(() => {
        const card = document.getElementById(`room-details-${roomNum}`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
          card.focus?.();
        }
      }, 200);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Validazione base
      const guestNameValue = formData.isGroup ? formData.agencyGroupName : formData.guestName;
      if (!guestNameValue) {
        throw new Error('Nome ospite/agenzia è obbligatorio');
      }
      if (!formData.checkInDate || !formData.checkOutDate) {
        throw new Error('Le date sono obbligatorie');
      }
      if (formData.roomNumbers.length === 0) {
        throw new Error('Seleziona almeno una camera');
      }

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

      const reservationData = {
        isGroup: formData.isGroup,
        agencyGroupName: formData.isGroup ? formData.agencyGroupName : '',
        guestName: guestNameValue,
        phoneNumber: formData.phoneNumber,
        checkInDate: Timestamp.fromDate(new Date(formData.checkInDate)),
        checkOutDate: Timestamp.fromDate(new Date(formData.checkOutDate)),
        roomNumbers: formData.roomNumbers.map(Number),
        roomCustomNames: formData.roomCustomNames || {},
        roomPrices: formData.roomPrices || {},
        price: priceToSave,
        priceWithoutExtras: finalSummary.base,
        priceWithExtras: finalSummary.calculatedTotal,
        deposit: finalSummary.deposit,
        status: formData.status,
        additionalNotes: formData.additionalNotes || '',
        totalPeople: Number(formData.totalPeople) || 0,
        paymentCompleted: formData.paymentCompleted || false,
        extraPerRoom: formData.extraPerRoom || {},
        roomCribs: formData.isGroup ? (formData.roomCribs || {}) : !!formData.roomCribs,
        guestsArrived: formData.guestsArrived || {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await addDoc(collection(db, 'reservations'), reservationData);

      setSuccess('Prenotazione creata con successo!');
      
      // Notifica parent
      if (onSuccess) {
        onSuccess();
      }

      // Reset form e chiudi dopo 1.5 secondi
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err) {
      console.error('Errore nella creazione:', err);
      setError(err.message || 'Errore nella creazione della prenotazione');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      isGroup: false,
      agencyGroupName: '',
      guestName: '',
      phoneNumber: '',
      checkInDate: '',
      checkOutDate: '',
      roomNumber: '',
      roomNumbers: [],
      roomCustomNames: {},
      roomPrices: {},
      price: 0,
      priceWithoutExtras: 0,
      priceWithExtras: 0,
      pricePerNight: '',
      customPrice: '',
      deposit: 0,
      status: 'in_attesa',
      additionalNotes: '',
      totalPeople: 0,
      paymentCompleted: false,
      extraPerRoom: {},
      roomCribs: false,
      guestsArrived: {},
    });
    setError('');
    setSuccess('');
    onClose();
  };

  if (!isOpen) return null;

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
            ➕ Nuova Prenotazione
          </h2>
          <button className="modal-close" onClick={handleClose} aria-label="Chiudi">
            ✕
          </button>
        </div>

        <div className="drawer-body" ref={drawerBodyRef}>
            {error && (
              <div className="error-message" style={{ marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            {success && (
              <div className="success-message" style={{ marginBottom: '1rem' }}>
                {success}
              </div>
            )}

            {/* Toggle Singola/Gruppo */}
            <div className="panel" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={!formData.isGroup}
                    onChange={switchToSingle}
                    style={{ width: '1.25rem', height: '1.25rem' }}
                  />
                  <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>Prenotazione Singola</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={formData.isGroup}
                    onChange={switchToGroup}
                    style={{ width: '1.25rem', height: '1.25rem' }}
                  />
                  <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>Prenotazione Multipla (Gruppo/Agenzia)</span>
                </label>
              </div>
            </div>

            {/* Informazioni Base */}
            <div className="form-container">
              <div className="form-grid">
                {/* Nome condizionale: Ospite vs Agenzia */}
                {formData.isGroup ? (
                  <div className="form-field">
                    <label>Nome Agenzia/Gruppo *</label>
                    <input
                      type="text"
                      name="agencyGroupName"
                      value={formData.agencyGroupName}
                      onChange={handleInputChange}
                      placeholder="Nome agenzia o gruppo"
                      required
                    />
                  </div>
                ) : (
                  <div className="form-field">
                    <label>Nome Ospite *</label>
                    <input
                      type="text"
                      name="guestName"
                      value={formData.guestName}
                      onChange={handleInputChange}
                      placeholder="Nome completo"
                      required
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
                  <small style={{ fontSize: '0.8rem', color: 'rgba(15, 23, 42, 0.65)' }}>
                    Opzionale
                  </small>
                </div>

                <div className="form-field">
                  <label>Check-in *</label>
                  <input
                    type="date"
                    name="checkInDate"
                    value={formData.checkInDate}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Check-out *</label>
                  <input
                    type="date"
                    name="checkOutDate"
                    value={formData.checkOutDate}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Numero Totale Persone</label>
                  <input
                    type="number"
                    name="totalPeople"
                    value={formData.totalPeople}
                    onChange={handleInputChange}
                    min="0"
                  />
                  <small style={{ fontSize: '0.8rem', color: 'rgba(15, 23, 42, 0.65)' }}>
                    Calcolato automaticamente dalle camere, ma puoi modificarlo
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
                      <span><strong>Notte/i:</strong> {pricingSummary.nights}</span>
                      <span><strong>Camere:</strong> {formData.roomNumbers.length || 1}</span>
                    </div>

                    {formData.isGroup ? (
                      <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.7)', background: 'rgba(226, 232, 240, 0.5)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                        Il prezzo base viene calcolato automaticamente dalla somma dei prezzi per notte
                        inseriti per ogni camera nella sezione sottostante.
                      </div>
                    ) : (
                      <div style={{ marginTop: '0.75rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '500', display: 'block', marginBottom: '0.35rem' }}>
                          Prezzo per Notte (€)
                        </label>
                        <input
                          type="number"
                          name="pricePerNight"
                          value={formData.pricePerNight}
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                          placeholder="Es. 100"
                          style={{ width: '100%' }}
                        />
                        <small style={{ fontSize: '0.75rem', color: 'rgba(15, 23, 42, 0.6)' }}>
                          Moltiplicato automaticamente per le notti selezionate.
                        </small>
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
                          placeholder="Lascia vuoto per usare il totale calcolato"
                          style={{ width: '100%' }}
                        />
                        <small style={{ fontSize: '0.75rem', color: 'rgba(15, 23, 42, 0.6)', display: 'block', marginTop: '0.3rem' }}>
                          Compila solo in caso di sconto/prezzo fisso globale.
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
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '1rem',
                      marginTop: '1rem'
                    }}>
                      <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: '500', display: 'block', marginBottom: '0.35rem' }}>
                          Prezzo Cumulativo Senza Extra (€)
                        </label>
                        <input
                          type="number"
                          name="priceWithoutExtras"
                          value={formData.priceWithoutExtras}
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                          placeholder="Es. 200"
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: '500', display: 'block', marginBottom: '0.35rem' }}>
                          Prezzo Cumulativo Con Extra (€)
                        </label>
                        <input
                          type="number"
                          name="priceWithExtras"
                          value={formData.priceWithExtras}
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                          placeholder="Es. 230"
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn--primary"
                        onClick={handleRecalculateTotals}
                      >
                        🧮 Calcola Con Extra
                      </button>
                    </div>

                    <div style={{
                      marginTop: '1.25rem',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '0.75rem'
                    }}>
                      <div style={{ padding: '0.75rem', background: '#fff', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(226, 232, 240, 0.8)' }}>
                        <strong style={{ fontSize: '0.85rem', color: '#15294F' }}>Prezzo Base</strong>
                        <p style={{ margin: '0.35rem 0 0', fontSize: '1rem' }}>€ {pricingSummary.base.toFixed(2)}</p>
                      </div>
                      <div style={{ padding: '0.75rem', background: '#fff', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(226, 232, 240, 0.8)' }}>
                        <strong style={{ fontSize: '0.85rem', color: '#15294F' }}>Extras</strong>
                        <p style={{ margin: '0.35rem 0 0', fontSize: '1rem' }}>€ {pricingSummary.extrasTotal.toFixed(2)}</p>
                      </div>
                      <div style={{ padding: '0.75rem', background: '#fff', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(226, 232, 240, 0.8)' }}>
                        <strong style={{ fontSize: '0.85rem', color: '#15294F' }}>Totale Calcolato</strong>
                        <p style={{ margin: '0.35rem 0 0', fontSize: '1rem', fontWeight: 600 }}>€ {pricingSummary.calculatedTotal.toFixed(2)}</p>
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

                    {Math.abs(finalPricePreview - pricingSummary.calculatedTotal) > 0.01 && (
                      <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(124, 58, 237, 0.08)', border: '1px solid rgba(124, 58, 237, 0.25)', color: '#5b21b6', fontSize: '0.85rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                        <span>Differenza rispetto al totale calcolato: € {(finalPricePreview - pricingSummary.calculatedTotal).toFixed(2)}</span>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => setFormData(prev => ({ ...prev, customPrice: '', price: pricingSummary.calculatedTotal.toFixed(2) }))}
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
                    placeholder="Note o richieste speciali..."
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>

            {/* Selezione Camere con Disponibilità */}
            <div className="panel" style={{ marginTop: '1.5rem' }}>
              <h3 className="panel-title">🏨 Seleziona Camere *</h3>
              <p style={{ fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.65)', marginTop: '0.5rem' }}>
                {formData.checkInDate && formData.checkOutDate 
                  ? `Disponibilità dal ${format(new Date(formData.checkInDate), 'dd/MM/yyyy')} al ${format(new Date(formData.checkOutDate), 'dd/MM/yyyy')}`
                  : 'Seleziona le date per vedere la disponibilità'}
              </p>

              {/* Legenda */}
              {formData.checkInDate && formData.checkOutDate && (
                <div style={{ 
                  display: 'flex', 
                  gap: '1rem', 
                  marginTop: '0.75rem',
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
              )}
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '0.75rem'
              }}>
                {Array.from({ length: 16 }, (_, i) => i + 1).map((roomNum) => {
                  const isSelected = formData.roomNumbers.includes(roomNum);
                  const roomType = ROOM_TYPES[roomNum];
                  const roomReservations = conflictingReservations[roomNum] || [];
                  const isBooked = roomReservations.length > 0;
                  
                  return (
                    <div
                      key={roomNum}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem',
                        padding: '0.625rem 0.75rem',
                        background: isSelected 
                          ? 'rgba(219, 234, 254, 0.9)'
                          : isBooked 
                            ? 'rgba(254, 242, 242, 0.8)'
                            : 'rgba(240, 253, 244, 0.8)',
                        border: `2px solid ${
                          isSelected 
                            ? '#15294F'
                            : isBooked 
                              ? 'rgba(239, 68, 68, 0.3)'
                              : 'rgba(34, 197, 94, 0.2)'
                        }`,
                        borderRadius: 'var(--radius-sm)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div 
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: isBooked ? 'not-allowed' : 'pointer' }}
                        onClick={() => !isBooked && handleRoomSelection(roomNum)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isBooked}
                          onChange={() => {}}
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
                              ? '#15294F' 
                              : isBooked 
                                ? '#dc2626' 
                                : '#22c55e',
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: '0.875rem', fontWeight: '500', flex: 1 }}>
                          Camera {roomNum}: {roomType}
                        </span>
                      </div>

                      {/* Mostra prenotazioni occupanti */}
                      {roomReservations.map((res, idx) => (
                        <div
                          key={idx}
                          style={{
                            fontSize: '0.8rem',
                            color: '#dc2626',
                            paddingLeft: '1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                          title={`${res.guestName} - ${format(res.checkInDate, 'dd/MM')} → ${format(res.checkOutDate, 'dd/MM')}${res.isGroup ? ` (${res.agencyGroupName})` : ''}`}
                        >
                          <span style={{ flexShrink: 0 }}>→</span>
                          <span style={{ 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap' 
                          }}>
                            {res.guestName} ({format(res.checkInDate, 'dd/MM')} → {format(res.checkOutDate, 'dd/MM')})
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Camere Selezionate - Cliccabili per modificare */}
            {formData.roomNumbers.length > 0 && (
              <div className="panel" style={{ marginTop: '1.5rem' }}>
                <h3 className="panel-title">✅ Camere Selezionate</h3>
                <p style={{ fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.65)', marginTop: '0.5rem' }}>
                  Clicca su una camera per modificare dettagli, nominativo e extras
                </p>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
                  gap: '0.75rem',
                  marginTop: '1rem'
                }}>
                  {formData.roomNumbers.map((roomNum) => (
                    <button
                      key={roomNum}
                      type="button"
                      onClick={() => {
                        const detailsSection = document.getElementById(`room-details-${roomNum}`);
                        if (detailsSection) {
                          detailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          detailsSection.focus?.();
                        }
                      }}
                      style={{
                        padding: '0.75rem 1rem',
                        background: 'linear-gradient(135deg, rgba(219, 234, 254, 0.95) 0%, rgba(191, 219, 254, 0.95) 100%)',
                        border: '2px solid rgba(37, 99, 235, 0.4)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#15294F' }}>
                        🚪 Camera {roomNum}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'rgba(15, 23, 42, 0.65)' }}>
                        {ROOM_TYPES[roomNum]}
                      </span>
                      {formData.roomCustomNames?.[roomNum] && (
                        <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: '500', marginTop: '0.25rem' }}>
                          👤 {formData.roomCustomNames[roomNum]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Dettagli per Camera (solo se camere selezionate) */}
            {formData.roomNumbers.length > 0 && (
              <div className="panel" style={{ marginTop: '1.5rem' }}>
                <h3 className="panel-title">📋 Dettagli per Camera</h3>
                <p style={{ fontSize: '0.85rem', color: 'rgba(15, 23, 42, 0.65)', marginTop: '0.5rem' }}>
                  {formData.isGroup 
                    ? 'Gestisci nominativi, extras e prezzi per ogni camera del gruppo'
                    : 'Gestisci nominativi e extras per la camera selezionata'}
                </p>
                
                <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
                  {formData.roomNumbers.map((roomNum) => (
                    <div 
                      key={roomNum}
                      id={`room-details-${roomNum}`}
                      tabIndex={-1}
                      style={{
                        padding: '1rem',
                        background: 'rgba(241, 245, 249, 0.5)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid rgba(226, 232, 240, 0.8)',
                        scrollMarginTop: '1rem'
                      }}
                    >
                      <h4 style={{ 
                        margin: '0 0 0.75rem', 
                        fontSize: '0.95rem', 
                        fontWeight: '600',
                        color: '#15294F' 
                      }}>
                        🚪 Camera {roomNum} - {ROOM_TYPES[roomNum]}
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
                            Prezzo per Notte (€)
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
                            placeholder="Es. 100"
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
                  ))}
                </div>
              </div>
            )}
        </div>

        <div className="drawer-footer">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleClose}
            disabled={loading}
          >
            Annulla
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Salvataggio...' : '✓ Crea Prenotazione'}
          </button>
        </div>
        </div>
      </div>
    </>,
    document.body
  );
}

export default AddReservationDrawer;
