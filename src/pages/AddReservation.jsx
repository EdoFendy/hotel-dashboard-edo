// src/pages/AddReservation.jsx

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, Timestamp, onSnapshot } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import EditReservationModal from '../components/EditReservationModal';
import '../styles/AddReservation.css'; // Assicurati che questo file CSS sia presente

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

function AddReservation() {
  const navigate = useNavigate();
  const [isMultiple, setIsMultiple] = useState(false);
  const [agencyGroupName, setAgencyGroupName] = useState('');
  const [guestName, setGuestName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [roomNumbers, setRoomNumbers] = useState([]);
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [status, setStatus] = useState('in_attesa');
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [cumulativePriceWithoutExtras, setCumulativePriceWithoutExtras] = useState('');
  const [cumulativePriceWithExtras, setCumulativePriceWithExtras] = useState('');
  const [extraBar, setExtraBar] = useState('');
  const [extraServizi, setExtraServizi] = useState('');
  const [petAllowed, setPetAllowed] = useState(false);
  const [customNames, setCustomNames] = useState({});
  const [roomPrices, setRoomPrices] = useState({});
  const [deposit, setDeposit] = useState('');
  const [totalPeople, setTotalPeople] = useState(0);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [error, setError] = useState('');

  const [availableRooms, setAvailableRooms] = useState([]);
  const [allReservations, setAllReservations] = useState([]);
  const [reservedRoomsMap, setReservedRoomsMap] = useState({});

  // Stato per il modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);

  // Stato per extras e guestsArrived per ogni camera
  const [roomExtras, setRoomExtras] = useState({});
  const [guestsArrived, setGuestsArrived] = useState({});

  // Stato per il Prezzo Personalizzato
  const [customPrice, setCustomPrice] = useState(''); // *** Nuovo Stato ***

  // Stato per culle
  const [roomCribs, setRoomCribs] = useState({});
  const [cribSingleRoom, setCribSingleRoom] = useState(false);

  // Stato per Prezzo per Notte (singola)
  const [pricePerNight, setPricePerNight] = useState(''); // *** Nuovo Stato ***

  // Funzione di utilità per calcolare il numero di giorni
  const calculateNumberOfDays = () => {
    if (!checkInDate || !checkOutDate) return 0;
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    const diffTime = end - start;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Recupera tutte le prenotazioni in tempo reale
  useEffect(() => {
    const reservationsRef = collection(db, 'reservations');
    const unsubscribe = onSnapshot(reservationsRef, (snapshot) => {
      const reservationsData = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setAllReservations(reservationsData);
    });

    return () => unsubscribe();
  }, []);

  // Calcolo disponibilità camere in base alle date selezionate
  useEffect(() => {
    if (checkInDate && checkOutDate) {
      const selectedCheckIn = new Date(checkInDate);
      const selectedCheckOut = new Date(checkOutDate);

      if (selectedCheckIn >= selectedCheckOut) {
        setError('La data di check-out deve essere successiva alla data di check-in.');
        setAvailableRooms([]);
        setReservedRoomsMap({});
        return;
      } else {
        setError('');
      }

      // Trova prenotazioni che si sovrappongono
      const overlappingReservations = allReservations.filter((reservation) => {
        const existingCheckIn = reservation.checkInDate.toDate();
        const existingCheckOut = reservation.checkOutDate.toDate();

        return (
          (selectedCheckIn >= existingCheckIn && selectedCheckIn < existingCheckOut) ||
          (selectedCheckOut > existingCheckIn && selectedCheckOut <= existingCheckOut) ||
          (selectedCheckIn <= existingCheckIn && selectedCheckOut >= existingCheckOut)
        );
      });

      // Crea una mappa da numero di camera a prenotazione
      const roomToReservation = {};
      overlappingReservations.forEach((reservation) => {
        const rooms = Array.isArray(reservation.roomNumbers) ? reservation.roomNumbers : [reservation.roomNumber];
        rooms.forEach((room) => {
          roomToReservation[String(room)] = reservation;
        });
      });

      setReservedRoomsMap(roomToReservation);

      // Camere occupate
      const reservedRoomNumbers = overlappingReservations
        .flatMap((r) => (Array.isArray(r.roomNumbers) ? r.roomNumbers : [r.roomNumber]))
        .map(String);

      const allRooms = Object.keys(ROOM_TYPES).map((num) => String(num));

      // Camere disponibili sono quelle non riservate
      const available = allRooms.filter(
        (num) => !reservedRoomNumbers.includes(num)
      );

      setAvailableRooms(available);
    } else {
      const allRooms = Object.keys(ROOM_TYPES).map((num) => String(num));
      setAvailableRooms(allRooms);
      setReservedRoomsMap({});
    }
  }, [checkInDate, checkOutDate, allReservations, roomNumbers]);

  // Calcola disponibilità automatica per prenotazioni singole
  useEffect(() => {
    if (!isMultiple && pricePerNight && checkInDate && checkOutDate) {
      const numberOfDays = calculateNumberOfDays();
      if (numberOfDays > 0) {
        const total = parseFloat(pricePerNight) * numberOfDays;
        setCumulativePriceWithoutExtras(total.toString());
      } else {
        setCumulativePriceWithoutExtras('');
      }
    }
  }, [pricePerNight, checkInDate, checkOutDate, isMultiple]);

  // Calcola disponibilità automatica per prenotazioni multiple
  useEffect(() => {
    if (isMultiple) {
      calculateTotalPriceWithoutExtras();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomPrices, isMultiple, checkInDate, checkOutDate]);

  // Calcola disponibilità automatica del prezzo cumulativo senza extras
  useEffect(() => {
    if (!isMultiple && cumulativePriceWithoutExtras) {
      // Potresti aggiungere ulteriori logiche se necessario
    }
  }, [cumulativePriceWithoutExtras, isMultiple]);

  // Calcola il numero totale di persone in base alle camere selezionate
  useEffect(() => {
    const total = roomNumbers.reduce((acc, roomNumber) => {
      const roomType = ROOM_TYPES[roomNumber];
      const capacity = ROOM_CAPACITIES[roomType] || 0;
      return acc + capacity;
    }, 0);
    setTotalPeople(total);
  }, [roomNumbers]);

  // Gestione selezione/deselezione camere
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

  // Gestione nome personalizzato per ogni camera (solo se isMultiple)
  const handleCustomNameChange = (room, newName) => {
    setCustomNames((prev) => ({
      ...prev,
      [room]: newName,
    }));
  };

  // Gestione prezzo per camera
  const handleRoomPriceChange = (room, newPrice) => {
    setRoomPrices((prev) => ({
      ...prev,
      [room]: newPrice >= 0 ? newPrice : 0,
    }));
  };

  // Gestione cambiamento extras per camera
  const handleRoomExtraChange = (room, field, value) => {
    setRoomExtras((prev) => ({
      ...prev,
      [room]: {
        ...prev[room],
        [field]: value,
      },
    }));
  };

  // Gestione "Guests Arrived" per camera
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
        const price = parseFloat(roomPrices[room]) || 0;
        return acc + (price * numberOfDays);
      }, 0);
    } else {
      basePrice = parseFloat(cumulativePriceWithoutExtras) || 0;
      // basePrice = basePrice * numberOfDays; // Rimosso poiché già calcolato automaticamente
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
        const price = parseFloat(roomPrices[room]) || 0;
        return acc + (price * numberOfDays);
      }, 0);
    } else {
      basePrice = parseFloat(cumulativePriceWithoutExtras) || 0;
    }

    let extrasTotal = 0;

    if (isMultiple) {
      extrasTotal = roomNumbers.reduce((acc, room) => {
        const extras = roomExtras[room] || {};
        const petTotal = extras.petAllowed ? 10 : 0; // Costo fisso
        const bar = parseFloat(extras.extraBar) || 0;
        const servizi = parseFloat(extras.extraServizi) || 0;
        const barTotal = bar; // Costo fisso
        const serviziTotal = servizi; // Costo fisso
        const cribTotal = roomCribs[room] ? 10 : 0; // Costo fisso per la culla
        return acc + petTotal + barTotal + serviziTotal + cribTotal;
      }, 0);
    } else {
      const petTotal = petAllowed ? 10 : 0; // Costo fisso
      const bar = parseFloat(extraBar) || 0;
      const servizi = parseFloat(extraServizi) || 0;
      const barTotal = bar; // Costo fisso
      const serviziTotal = servizi; // Costo fisso
      const cribTotal = cribSingleRoom ? 10 : 0; // Costo fisso per la culla
      extrasTotal = petTotal + barTotal + serviziTotal + cribTotal;
    }

    const total = basePrice + extrasTotal;
    setCumulativePriceWithExtras(total.toString());
    setError('');
  };

  // Funzione chiamata dopo l'aggiornamento della prenotazione nel modal
  const handleReservationUpdated = () => {
    // Puoi aggiungere logica per aggiornare la lista delle camere o altre parti della UI
    // Ad esempio, puoi reimpostare le camere selezionate se necessario
    setError('');
    closeModal();
  };

  // Definizione della funzione closeModal
  const closeModal = () => {
    setSelectedReservation(null);
    setIsModalOpen(false);
  };

  // Apertura del modal
  const openModal = (reservation) => {
    setSelectedReservation(reservation);
    setIsModalOpen(true);
  };

  // Gestione dell'invio del form
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
    const parsedCustomPrice = customPrice.trim() !== '' ? parseFloat(customPrice) : null;
  
    if (isNaN(parsedPriceWithoutExtras) || parsedPriceWithoutExtras < 0) {
      setError('Il prezzo cumulativo senza extra non è valido.');
      return;
    }
    if (isNaN(parsedPriceWithExtras) || parsedPriceWithExtras < 0) {
      setError('Il prezzo cumulativo con extra non è valido.');
      return;
    }
    if (parsedCustomPrice !== null && (isNaN(parsedCustomPrice) || parsedCustomPrice < 0)) {
      setError('Il prezzo personalizzato non è valido.');
      return;
    }
  
    // Determina il prezzo finale da salvare
    const finalPrice = parsedCustomPrice !== null ? parsedCustomPrice : parsedPriceWithoutExtras;
  
    console.log({
      customPrice,
      cumulativePriceWithoutExtras,
      cumulativePriceWithExtras,
      finalPrice,
    });
  
    try {
      const reservationsRef = collection(db, 'reservations');
      await addDoc(reservationsRef, {
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
        price: finalPrice, // Salva il prezzo corretto
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
        createdAt: Timestamp.now(),
        additionalNotes: additionalNotes.trim() || null,
      });
  
      setError('');
      navigate('/reservations');
    } catch (err) {
      console.error('Errore durante l\'aggiunta della prenotazione:', err);
      setError('Errore durante l\'aggiunta della prenotazione.');
    }
  };
  

  return (
    <Layout>
      <div className="add-reservation">
        <h2>Aggiungi Prenotazione</h2>
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

          {/* Numero di Telefono */}
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

          {/* Stato Prenotazione */}
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

          {/* Check-in Date */}
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

          {/* Check-out Date */}
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

          {/* Selezione Camere Disponibili */}
          <div className="form-group">
            <label>Camere Disponibili:</label>
            <div className="room-selection">
              {Object.entries(ROOM_TYPES).map(([number, type]) => {
                const isAvailable = availableRooms.includes(number);
                const isSelected = roomNumbers.includes(number);
                const isReserved = !isAvailable && reservedRoomsMap[number];
                const reservation = reservedRoomsMap[number];

                return (
                  <div key={number} className="room-option">
                    <input
                      type="checkbox"
                      id={`room-${number}`}
                      value={number}
                      checked={isSelected}
                      onChange={handleRoomSelection}
                      disabled={!isAvailable && !isSelected}
                    />
                    {isReserved ? (
                      <label htmlFor={`room-${number}`}>
                        <span className="status-dot red" title="Occupata"></span>
                        <Link
                          to="#"
                          onClick={(e) => {
                            e.preventDefault();
                            openModal(reservation);
                          }}
                          className="edit-reservation-link"
                        >
                          {` Camera ${number}: ${type} (Prenotata)`}
                        </Link>
                      </label>
                    ) : (
                      <label htmlFor={`room-${number}`}>
                        <span
                          className={`status-dot ${isAvailable ? 'green' : 'red'}`}
                          title={isAvailable ? 'Disponibile' : 'Occupata'}
                        />
                        {` Camera ${number}: ${type}`}
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sezione Dettagli ed Extras per Camera Selezionata */}
          {isMultiple && roomNumbers.length > 0 && (
            <div className="form-group">
              <label>Dettagli ed Extra per Camera:</label>
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
                        onChange={(e) => handleRoomPriceChange(room, parseFloat(e.target.value) || 0)}
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
                      <label htmlFor={`extraBar-${room}`}>Extra Bar:</label>
                      <input
                        type="number"
                        id={`extraBar-${room}`}
                        value={roomExtras[room]?.extraBar || 0}
                        onChange={(e) => handleRoomExtraChange(room, 'extraBar', parseFloat(e.target.value) || 0)}
                        placeholder="Es. 20"
                        min={0}
                        className="extra-bar"
                      />
                    </div>

                    {/* Extra Servizi */}
                    <div className="form-group">
                      <label htmlFor={`extraServizi-${room}`}>Extra Servizi(€):</label>
                      <input
                        type="number"
                        id={`extraServizi-${room}`}
                        value={roomExtras[room]?.extraServizi || 0}
                        onChange={(e) => handleRoomExtraChange(room, 'extraServizi', parseFloat(e.target.value) || 0)}
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
                      <label htmlFor={`guestsArrived-${room}`}>Guests Arrived</label>
                    </div>

                    {/* Extra Culla */}
                    <div className="form-group checkbox-crib">
                      <input
                        type="checkbox"
                        id={`roomCribs-${room}`}
                        checked={roomCribs[room] || false}
                        onChange={(e) => handleRoomCribsChange(room, e.target.checked)}
                      />
                      <label htmlFor={`roomCribs-${room}`}>Culla (+10€)</label>
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
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
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
            {isMultiple ? (
              <>
                {/* Prezzo Cumulativo Senza Extras */}
                <div className="cumulative-price-subgroup">
                  <label htmlFor="cumulativePriceWithoutExtras">Prezzo Cumulativo Senza Extra (€):</label>
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
                      Calcola Senza Extra
                    </button>
                  </div>
                </div>

                {/* Prezzo Cumulativo Con Extras */}
                <div className="cumulative-price-subgroup">
                  <label htmlFor="cumulativePriceWithExtras">Prezzo Cumulativo Con Extra (€):</label>
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
                      Calcola Con Extra
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Prezzo per Notte */}
                <div className="cumulative-price-subgroup">
                  <label htmlFor="pricePerNight">Prezzo per Notte (€):</label>
                  <div className="cumulative-price-container">
                    <input
                      type="number"
                      id="pricePerNight"
                      value={pricePerNight}
                      onChange={(e) => setPricePerNight(e.target.value)}
                      placeholder="Es. 100"
                      min={0}
                      required
                      className="cumulative-price"
                    />
                  </div>
                </div>

                {/* Prezzo Cumulativo Senza Extras */}
                <div className="cumulative-price-subgroup">
                  <label htmlFor="cumulativePriceWithoutExtras">Prezzo Cumulativo Senza Extra (€):</label>
                  <div className="cumulative-price-container">
                    <input
                      type="number"
                      id="cumulativePriceWithoutExtras"
                      value={cumulativePriceWithoutExtras}
                      readOnly
                      placeholder="Calcolato automaticamente"
                      min={0}
                      required
                      className="cumulative-price readonly"
                    />
                  </div>
                </div>

                {/* Prezzo Cumulativo Con Extras */}
                <div className="cumulative-price-subgroup">
                  <label htmlFor="cumulativePriceWithExtras">Prezzo Cumulativo Con Extra (€):</label>
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
                      Calcola Con Extra
                    </button>
                  </div>
                </div>
              </>
            )}
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
                <label htmlFor="cribSingleRoom">Culla (+10€)</label>
              </div>

              <div className="form-group">
                <label htmlFor="extraBar">Extra Bar(€):</label>
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
                <label htmlFor="extraServizi">Extra Servizi(€):</label>
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
            <label htmlFor="deposit">Caparra(€):</label>
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

          {/* Bottone Submit */}
          <div className="form-group button-group">
            <button
              type="submit"
              className="submit-btn"
            >
              Aggiungi Prenotazione
            </button>
          </div>
        </form>

        {/* Modal per modificare una prenotazione esistente */}
        <EditReservationModal
          isOpen={isModalOpen}
          onClose={closeModal}
          reservation={selectedReservation}
          onUpdateSuccess={handleReservationUpdated}
        />
      </div>
    </Layout>
  );
}

export default AddReservation;
