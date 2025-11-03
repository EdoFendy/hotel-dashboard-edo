// src/components/EditReservationModal.jsx

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import '../styles/EditReservationModal.css'; // Assicurati di avere questo file CSS

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
  Quadrupla: 4,
  Tripla: 3,
  'Doppia + Bagno per Handicap': 2,
  Matrimoniale: 2,
  Singola: 1,
  'Matrimoniale/Doppia': 2,
};

const RESERVATION_STATUSES = [
  { value: 'in_attesa', label: 'In Attesa', color: 'orange' },
  { value: 'confermata', label: 'Confermata', color: 'green' },
  { value: 'annullata', label: 'Annullata', color: 'red' },
  { value: 'conclusa', label: 'Conclusa', color: 'blue' },
];

const EditReservationModal = ({ isOpen, onClose, reservation, onUpdateSuccess }) => {
  if (!isOpen || !reservation) return null;

  // Stato locale per tutti i campi della prenotazione
  const [isMultiple, setIsMultiple] = useState(reservation.isGroup || false);
  const [agencyGroupName, setAgencyGroupName] = useState(reservation.agencyGroupName || '');
  const [guestName, setGuestName] = useState(reservation.guestName || '');
  const [phoneNumber, setPhoneNumber] = useState(reservation.phoneNumber || '');
  const [roomNumbers, setRoomNumbers] = useState(
    Array.isArray(reservation.roomNumbers) ? reservation.roomNumbers.map(String) : [String(reservation.roomNumber)]
  );
  const [checkInDate, setCheckInDate] = useState(
    reservation.checkInDate.toDate().toISOString().substr(0, 10)
  );
  const [checkOutDate, setCheckOutDate] = useState(
    reservation.checkOutDate.toDate().toISOString().substr(0, 10)
  );
  const [status, setStatus] = useState(reservation.status || 'in_attesa');
  const [paymentCompleted, setPaymentCompleted] = useState(reservation.paymentCompleted || false);
  const [cumulativePriceWithoutExtras, setCumulativePriceWithoutExtras] = useState(
    reservation.priceWithoutExtras ? String(reservation.priceWithoutExtras) : ''
  );
  const [cumulativePriceWithExtras, setCumulativePriceWithExtras] = useState(
    reservation.priceWithExtras ? String(reservation.priceWithExtras) : ''
  );
  const [extraBar, setExtraBar] = useState(
    reservation.extraPerRoom && !isMultiple ? String(reservation.extraPerRoom.extraBar || 0) : ''
  );
  const [extraServizi, setExtraServizi] = useState(
    reservation.extraPerRoom && !isMultiple ? String(reservation.extraPerRoom.extraServizi || 0) : ''
  );
  const [petAllowed, setPetAllowed] = useState(
    reservation.extraPerRoom && !isMultiple ? reservation.extraPerRoom.petAllowed || false : false
  );
  const [customNames, setCustomNames] = useState(reservation.roomCustomNames || {});
  const [roomPrices, setRoomPrices] = useState(reservation.roomPrices || {});
  const [deposit, setDeposit] = useState(reservation.deposit ? String(reservation.deposit) : '');
  const [totalPeople, setTotalPeople] = useState(reservation.totalPeople || 0);
  const [additionalNotes, setAdditionalNotes] = useState(reservation.additionalNotes || '');
  const [error, setError] = useState('');

  // Stato per extras e guestsArrived per ogni camera (solo se isMultiple)
  const [roomExtras, setRoomExtras] = useState(reservation.extraPerRoom || {});
  const [guestsArrived, setGuestsArrived] = useState(reservation.guestsArrived || {});

  // Stato per culle
  const [roomCribs, setRoomCribs] = useState(reservation.roomCribs || {});
  const [cribSingleRoom, setCribSingleRoom] = useState(
    !isMultiple ? reservation.roomCribs || false : false
  );

  // Calcolo del numero totale di persone basato sulle camere selezionate
  useEffect(() => {
    const total = roomNumbers.reduce((acc, roomNumber) => {
      const roomType = ROOM_TYPES[roomNumber];
      const capacity = ROOM_CAPACITIES[roomType] || 0;
      return acc + capacity;
    }, 0);
    setTotalPeople(total);
  }, [roomNumbers]);

  // Gestione della selezione/deselezione delle camere
  const handleRoomSelection = (e) => {
    const { value, checked } = e.target;
    if (checked) {
      setRoomNumbers((prev) => [...prev, value]);
      setCustomNames((prev) => ({
        ...prev,
        [value]: prev[value] || '',
      }));
      setRoomPrices((prev) => ({
        ...prev,
        [value]: prev[value] || 0,
      }));
      setRoomCribs((prev) => ({
        ...prev,
        [value]: false,
      }));
      if (isMultiple) {
        setRoomExtras((prev) => ({
          ...prev,
          [value]: {
            petAllowed: false,
            extraBar: 0,
            extraServizi: 0,
          },
        }));
        setGuestsArrived((prev) => ({
          ...prev,
          [value]: false,
        }));
      }
    } else {
      setRoomNumbers((prev) => prev.filter((room) => room !== value));
      setCustomNames((prev) => {
        const updated = { ...prev };
        delete updated[value];
        return updated;
      });
      setRoomPrices((prev) => {
        const updated = { ...prev };
        delete updated[value];
        return updated;
      });
      setRoomCribs((prev) => {
        const updated = { ...prev };
        delete updated[value];
        return updated;
      });
      if (isMultiple) {
        setRoomExtras((prev) => {
          const updated = { ...prev };
          delete updated[value];
          return updated;
        });
        setGuestsArrived((prev) => {
          const updated = { ...prev };
          delete updated[value];
          return updated;
        });
      }
    }
  };

  // Gestione dei nomi personalizzati per le camere
  const handleCustomNameChange = (room, newName) => {
    setCustomNames((prev) => ({
      ...prev,
      [room]: newName,
    }));
  };

  // Gestione dei prezzi per le camere
  const handleRoomPriceChange = (room, newPrice) => {
    setRoomPrices((prev) => ({
      ...prev,
      [room]: newPrice >= 0 ? newPrice : 0,
    }));
  };

  // Gestione cambiamento extras per camera (solo se isMultiple)
  const handleRoomExtraChange = (room, field, value) => {
    setRoomExtras((prev) => ({
      ...prev,
      [room]: {
        ...prev[room],
        [field]: value,
      },
    }));
  };

  // Gestione "Guests Arrived" per camera (solo se isMultiple)
  const handleGuestsArrivedChange = (room, value) => {
    setGuestsArrived((prev) => ({
      ...prev,
      [room]: value,
    }));
  };

  // Gestione dei cambiamenti per roomCribs nelle prenotazioni multiple
  const handleRoomCribsChange = (room, value) => {
    setRoomCribs((prev) => ({
      ...prev,
      [room]: value,
    }));
  };

  // Calcolo prezzo cumulativo senza extras
  const calculateTotalPriceWithoutExtras = () => {
    const numberOfDays = calculateNumberOfDays();
    if (numberOfDays <= 0) {
      setError('Calcolo non possibile: verifica le date di check-in e check-out.');
      return;
    }

    let basePrice = 0;
    if (isMultiple) {
      basePrice = roomNumbers.reduce((acc, room) => {
        const price = parseInt(roomPrices[room], 10) || 0;
        return acc + (price * numberOfDays);
      }, 0);
    } else {
      basePrice = parseInt(cumulativePriceWithoutExtras, 10) || 0;
      basePrice = basePrice * numberOfDays;
    }

    setCumulativePriceWithoutExtras(basePrice.toString());
    setError('');
  };

  // Calcolo prezzo cumulativo con extras
  const calculateTotalPriceWithExtras = () => {
    const numberOfDays = calculateNumberOfDays();
    if (numberOfDays <= 0) {
      setError('Calcolo non possibile: verifica le date di check-in e check-out.');
      return;
    }

    let basePrice = 0;
    if (isMultiple) {
      basePrice = roomNumbers.reduce((acc, room) => {
        const price = parseInt(roomPrices[room], 10) || 0;
        return acc + (price * numberOfDays);
      }, 0);
    } else {
      basePrice = parseInt(cumulativePriceWithExtras, 10) || 0;
      basePrice = basePrice * numberOfDays;
    }

    let extrasTotal = 0;

    if (isMultiple) {
      extrasTotal = roomNumbers.reduce((acc, room) => {
        const extras = roomExtras[room] || {};
        const petTotal = extras.petAllowed ? 10 : 0; // Costo fisso
        const bar = parseInt(extras.extraBar, 10) || 0;
        const servizi = parseInt(extras.extraServizi, 10) || 0;
        const barTotal = bar; // Costo fisso
        const serviziTotal = servizi; // Costo fisso
        const cribTotal = roomCribs[room] ? 10 : 0; // Costo fisso per la culla
        return acc + petTotal + barTotal + serviziTotal + cribTotal;
      }, 0);
    } else {
      const petTotal = petAllowed ? 10 : 0; // Costo fisso
      const bar = parseInt(extraBar, 10) || 0;
      const servizi = parseInt(extraServizi, 10) || 0;
      const barTotal = bar; // Costo fisso
      const serviziTotal = servizi; // Costo fisso
      const cribTotal = cribSingleRoom ? 10 : 0; // Costo fisso per la culla
      extrasTotal = petTotal + barTotal + serviziTotal + cribTotal;
    }

    const total = basePrice + extrasTotal;
    setCumulativePriceWithExtras(total.toString());
    setError('');
  };

  // Funzione di utilità per calcolare il numero di giorni
  const calculateNumberOfDays = () => {
    if (!checkInDate || !checkOutDate) return 0;
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    const diffTime = end - start;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Gestione dell'invio del form di modifica prenotazione
  const handleSubmit = async (e) => {
    e.preventDefault();
  
    // Validazione delle date
    if (!checkInDate || !checkOutDate) {
      setError('Seleziona date di check-in e check-out.');
      return;
    }
    if (new Date(checkInDate) >= new Date(checkOutDate)) {
      setError('La data di check-out deve essere successiva alla data di check-in.');
      return;
    }
  
    // Validazione delle camere
    if (roomNumbers.length === 0) {
      setError('Seleziona almeno una camera.');
      return;
    }
  
    // Calcolo del numero di giorni
    const numberOfDays = calculateNumberOfDays();
    if (numberOfDays <= 0) {
      setError('Calcolo non possibile: verifica le date di check-in e check-out.');
      return;
    }
  
    // Validazione dei prezzi
    const parsedPriceWithoutExtras = parseFloat(cumulativePriceWithoutExtras) || 0;
    const parsedPriceWithExtras = parseFloat(cumulativePriceWithExtras) || 0;
    const parsedCustomPrice = parsedPriceWithoutExtras; // Consideriamo il prezzo personalizzato dal totale senza extra.
  
    if (isNaN(parsedPriceWithoutExtras) || parsedPriceWithoutExtras < 0) {
      setError('Il prezzo cumulativo senza extra non è valido.');
      return;
    }
    if (isNaN(parsedPriceWithExtras) || parsedPriceWithExtras < 0) {
      setError('Il prezzo cumulativo con extra non è valido.');
      return;
    }
  
    // Determinazione del prezzo finale
    const finalPrice = parsedPriceWithExtras;
  
    console.log({
      cumulativePriceWithoutExtras,
      cumulativePriceWithExtras,
      finalPrice,
    });
  
    try {
      const docRef = doc(db, 'reservations', reservation.id);
      await updateDoc(docRef, {
        isGroup: isMultiple,
        agencyGroupName: isMultiple ? agencyGroupName : '',
        guestName: isMultiple ? agencyGroupName : guestName,
        phoneNumber,
        status,
        roomNumbers: roomNumbers.map(Number),
        roomCustomNames: isMultiple ? customNames : {},
        roomPrices: isMultiple ? roomPrices : {},
        priceWithoutExtras: parsedPriceWithoutExtras,
        priceWithExtras: parsedPriceWithExtras,
        price: finalPrice, // Salvataggio del prezzo finale
        roomCribs: isMultiple ? roomCribs : cribSingleRoom,
        extraPerRoom: isMultiple
          ? roomExtras
          : {
              petAllowed,
              extraBar: parseFloat(extraBar) || 0,
              extraServizi: parseFloat(extraServizi) || 0,
            },
        guestsArrived: isMultiple ? guestsArrived : {},
        deposit: deposit ? parseFloat(deposit) : 0,
        checkInDate: Timestamp.fromDate(new Date(checkInDate)),
        checkOutDate: Timestamp.fromDate(new Date(checkOutDate)),
        paymentCompleted,
        totalPeople,
        updatedAt: Timestamp.now(),
        additionalNotes: additionalNotes.trim() !== '' ? additionalNotes : null,
      });
  
      setError('');
      if (onUpdateSuccess) {
        onUpdateSuccess();
      }
      onClose();
    } catch (err) {
      console.error('Errore durante l\'aggiornamento della prenotazione:', err);
      setError('Errore durante l\'aggiornamento della prenotazione');
    }
  };
  

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close-btn" onClick={onClose}>
          &times;
        </button>
        <h2>Modifica Prenotazione</h2>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit}>
          {/* Selettore singola/multipla */}
          <div className="radio-group">
            <label>
              <input
                type="radio"
                value="single"
                checked={!isMultiple}
                onChange={() => setIsMultiple(false)}
              />
              Prenotazione Singola
            </label>
            <label>
              <input
                type="radio"
                value="multiple"
                checked={isMultiple}
                onChange={() => setIsMultiple(true)}
              />
              Prenotazione Multipla (Gruppo/Agenzia)
            </label>
          </div>

          {/* Se multipla => nome agenzia, se singola => nome ospite */}
          {isMultiple ? (
            <div className="form-group">
              <label htmlFor="agencyGroupName">Nome Agenzia/Gruppo:</label>
              <input
                type="text"
                id="agencyGroupName"
                value={agencyGroupName}
                onChange={(e) => setAgencyGroupName(e.target.value)}
                required
              />
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="guestName">Nome Ospite:</label>
              <input
                type="text"
                id="guestName"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="phoneNumber">Numero di Telefono (opzionale):</label>
            <input
              type="tel"
              id="phoneNumber"
              pattern="^\+?[0-9]{7,15}$"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+391234567890"
            />
          </div>

          <div className="form-group">
            <label htmlFor="status">Stato Prenotazione:</label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {RESERVATION_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="checkInDate">Check-in:</label>
            <input
              type="date"
              id="checkInDate"
              value={checkInDate}
              onChange={(e) => setCheckInDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="checkOutDate">Check-out:</label>
            <input
              type="date"
              id="checkOutDate"
              value={checkOutDate}
              onChange={(e) => setCheckOutDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Camere Disponibili:</label>
            <div className="room-selection">
              {Object.entries(ROOM_TYPES).map(([number, type]) => {
                const isSelected = roomNumbers.includes(number);
                return (
                  <div key={number} className="room-option">
                    <input
                      type="checkbox"
                      id={`room-${number}`}
                      value={number}
                      checked={isSelected}
                      onChange={handleRoomSelection}
                    />
                    <label htmlFor={`room-${number}`}>
                      <span
                        className={`status-dot ${
                          isSelected ? 'green' : 'red'
                        }`}
                        title={isSelected ? 'Occupata' : 'Disponibile'}
                      />
                      {` Camera ${number}: ${type}`}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sezione Dettagli ed Extras per Camera Selezionata */}
          {isMultiple && roomNumbers.length > 0 && (
            <div className="form-group">
              <label>Dettagli ed Extras per Camera:</label>
              <div className="room-extras">
                {roomNumbers.map((room) => (
                  <div key={room} className="room-extra">
                    <h4>Camera {room}</h4>

                    {/* Nome Camera */}
                    <div className="form-group">
                      <label htmlFor={`customName-${room}`}>Nome Camera {room}:</label>
                      <input
                        type="text"
                        id={`customName-${room}`}
                        value={customNames[room] || ''}
                        onChange={(e) => handleCustomNameChange(room, e.target.value)}
                        placeholder={`Nome stanza ${room}`}
                        className="custom-room-name"
                      />
                    </div>

                    {/* Prezzo per Notte */}
                    <div className="form-group">
                      <label htmlFor={`price-${room}`}>Prezzo per Notte (€):</label>
                      <input
                        type="number"
                        id={`price-${room}`}
                        value={roomPrices[room] || ''}
                        onChange={(e) => handleRoomPriceChange(room, parseInt(e.target.value, 10) || 0)}
                        placeholder="Es. 100"
                        min={0}
                        className="room-price"
                      />
                    </div>

                    {/* Extra Pet */}
                    <div className="form-group checkbox-pet">
                      <input
                        type="checkbox"
                        id={`petAllowed-${room}`}
                        checked={roomExtras[room]?.petAllowed || false}
                        onChange={(e) => handleRoomExtraChange(room, 'petAllowed', e.target.checked)}
                      />
                      <label htmlFor={`petAllowed-${room}`}>Extra Pet (+10€)</label>
                    </div>

                    {/* Extra Bar */}
                    <div className="form-group">
                      <label htmlFor={`extraBar-${room}`}>Extra Bar (intero):</label>
                      <input
                        type="number"
                        id={`extraBar-${room}`}
                        value={roomExtras[room]?.extraBar || 0}
                        onChange={(e) => handleRoomExtraChange(room, 'extraBar', parseInt(e.target.value, 10) || 0)}
                        placeholder="Es. 20"
                        min={0}
                        className="extra-bar"
                      />
                    </div>

                    {/* Extra Servizi */}
                    <div className="form-group">
                      <label htmlFor={`extraServizi-${room}`}>Extra Servizi (intero):</label>
                      <input
                        type="number"
                        id={`extraServizi-${room}`}
                        value={roomExtras[room]?.extraServizi || 0}
                        onChange={(e) => handleRoomExtraChange(room, 'extraServizi', parseInt(e.target.value, 10) || 0)}
                        placeholder="Es. 30"
                        min={0}
                        className="extra-servizi"
                      />
                    </div>

                    {/* Guests Arrived */}
                    <div className="form-group checkbox-guests-arrived">
                      <input
                        type="checkbox"
                        id={`guestsArrived-${room}`}
                        checked={guestsArrived[room] || false}
                        onChange={(e) => handleGuestsArrivedChange(room, e.target.checked)}
                      />
                      <label htmlFor={`guestsArrived-${room}`}>Ospite Arrivato</label>
                    </div>

                    {/* Extra Culla */}
                    <div className="form-group checkbox-crib">
                      <input
                        type="checkbox"
                        id={`roomCribs-${room}`}
                        checked={roomCribs[room] || false}
                        onChange={(e) => handleRoomCribsChange(room, e.target.checked)}
                      />
                      <label htmlFor={`roomCribs-${room}`}>Culla Necessaria (+10€)</label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Numero totale di persone */}
          <div className="form-group">
            <label htmlFor="totalPeople">Numero Totale di Persone:</label>
            <input
              type="number"
              id="totalPeople"
              value={totalPeople}
              onChange={(e) => setTotalPeople(parseInt(e.target.value, 10) || 0)}
              min={1}
              required
            />
          </div>

          {/* Prezzo Personalizzato */}
          <div className="form-group">
            <label htmlFor="customPrice">Prezzo Personalizzato (€):</label>
            <input
              type="number"
              id="customPrice"
              value={cumulativePriceWithoutExtras} // Se il prezzo personalizzato è gestito separatamente, adattare qui
              onChange={(e) => setCumulativePriceWithoutExtras(e.target.value)}
              placeholder="Es. 150"
              min={0}
              className="custom-price"
            />
            <small>
              Se non inserisci un prezzo personalizzato, verrà utilizzato il prezzo totale senza extra.
            </small>
          </div>

          {/* Sezione Prezzi Cumulativi */}
          <div className="form-group cumulative-price-group">
            {/* Prezzo Cumulativo Senza Extras */}
            <div className="cumulative-price-subgroup">
              <label htmlFor="cumulativePriceWithoutExtras">Prezzo Cumulativo Senza Extras (€):</label>
              <div className="cumulative-price-container">
                <input
                  type="number"
                  id="cumulativePriceWithoutExtras"
                  value={cumulativePriceWithoutExtras}
                  onChange={(e) => setCumulativePriceWithoutExtras(e.target.value)}
                  placeholder="Es. 100"
                  min={0}
                  required
                  className="cumulative-price"
                />
                <button
                  type="button"
                  className="calculate-btn small"
                  onClick={calculateTotalPriceWithoutExtras}
                >
                  Calcola Senza Extras
                </button>
              </div>
            </div>

            {/* Prezzo Cumulativo Con Extras */}
            <div className="cumulative-price-subgroup">
              <label htmlFor="cumulativePriceWithExtras">Prezzo Cumulativo Con Extras (€):</label>
              <div className="cumulative-price-container">
                <input
                  type="number"
                  id="cumulativePriceWithExtras"
                  value={cumulativePriceWithExtras}
                  onChange={(e) => setCumulativePriceWithExtras(e.target.value)}
                  placeholder="Es. 130"
                  min={0}
                  required
                  className="cumulative-price"
                />
                <button
                  type="button"
                  className="calculate-btn small"
                  onClick={calculateTotalPriceWithExtras}
                >
                  Calcola Con Extras
                </button>
              </div>
            </div>
          </div>

          {/* Note Aggiuntive */}
          <div className="form-group">
            <label htmlFor="additionalNotes">Note Aggiuntive (opzionale):</label>
            <textarea
              id="additionalNotes"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Inserisci eventuali richieste o dettagli aggiuntivi..."
              rows={4}
            ></textarea>
          </div>

          {/* Extra per prenotazioni singole */}
          {!isMultiple && (
            <div className="extras">
              <h3>Extra</h3>
              <div className="form-group checkbox-pet">
                <input
                  type="checkbox"
                  id="petAllowed"
                  checked={petAllowed}
                  onChange={() => setPetAllowed(!petAllowed)}
                />
                <label htmlFor="petAllowed">Extra Pet (+10€ per camera)</label>
              </div>

              {/* Extra Culla per prenotazioni singole */}
              <div className="form-group checkbox-crib-single">
                <input
                  type="checkbox"
                  id="cribSingleRoom"
                  checked={cribSingleRoom}
                  onChange={(e) => setCribSingleRoom(e.target.checked)}
                />
                <label htmlFor="cribSingleRoom">Culla Necessaria (+10€)</label>
              </div>

              <div className="form-group">
                <label htmlFor="extraBar">Extra Bar (intero):</label>
                <input
                  type="number"
                  id="extraBar"
                  value={extraBar}
                  onChange={(e) => setExtraBar(e.target.value)}
                  placeholder="Es. 20"
                  min={0}
                />
              </div>

              <div className="form-group">
                <label htmlFor="extraServizi">Extra Servizi (intero):</label>
                <input
                  type="number"
                  id="extraServizi"
                  value={extraServizi}
                  onChange={(e) => setExtraServizi(e.target.value)}
                  placeholder="Es. 30"
                  min={0}
                />
              </div>
            </div>
          )}

          {/* Caparra */}
          <div className="form-group">
            <label htmlFor="deposit">Caparra (opzionale, intero) (€):</label>
            <input
              type="number"
              id="deposit"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              placeholder="Es. 50"
              min={0}
            />
          </div>

          {/* Checkbox Pagamento */}
          <div className="form-group payment-checkbox">
            <input
              type="checkbox"
              id="paymentCompleted"
              checked={paymentCompleted}
              onChange={(e) => setPaymentCompleted(e.target.checked)}
            />
            <label htmlFor="paymentCompleted">Pagamento Completato</label>
          </div>

          {/* Bottone calcolo prezzo e submit */}
          <div className="form-group button-group">
            <button
              type="button"
              className="calculate-btn"
              onClick={isMultiple ? calculateTotalPriceWithExtras : calculateTotalPriceWithExtras}
            >
              Calcola Prezzo Totale
            </button>

            <button type="submit" className="submit-btn">
              Salva Modifiche
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditReservationModal;
