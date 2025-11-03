import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { N, PET_EXTRA, CRIB_EXTRA } from '../../utils/pricing';
import '../../styles/AddReservation.css';

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
  { value: 'in_attesa', label: 'In Attesa' },
  { value: 'confermata', label: 'Confermata' },
  { value: 'annullata', label: 'Annullata' },
  { value: 'conclusa', label: 'Conclusa' },
];

const ALL_ROOMS = Object.keys(ROOM_TYPES).map((num) => Number(num)).sort((a, b) => a - b);

const STEP_LABELS = [
  'Tipologia e anagrafica',
  'Dettagli del soggiorno',
  'Prezzi ed extra',
  'Riepilogo finale',
];

const formatCurrency = (value) => {
  const number = Number.isFinite(value) ? value : N(value);
  return number.toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  });
};

const calculateNights = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diff = end.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0);
  const nights = Math.round(diff / (1000 * 60 * 60 * 24));
  return nights > 0 ? nights : 0;
};

const buildConflictMap = (reservations, checkIn, checkOut) => {
  if (!checkIn || !checkOut) {
    return { conflicts: {}, availableRooms: ALL_ROOMS };
  }

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime())) {
    return { conflicts: {}, availableRooms: ALL_ROOMS };
  }
  if (checkOutDate <= checkInDate) {
    return { conflicts: {}, availableRooms: [] };
  }

  const conflicts = {};
  reservations.forEach((reservation) => {
    const start = reservation.checkInDate?.toDate
      ? reservation.checkInDate.toDate()
      : new Date(reservation.checkInDate);
    const end = reservation.checkOutDate?.toDate
      ? reservation.checkOutDate.toDate()
      : new Date(reservation.checkOutDate);

    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return;
    }

    const overlaps = start < checkOutDate && end > checkInDate;
    if (!overlaps) return;

    const rooms = Array.isArray(reservation.roomNumbers)
      ? reservation.roomNumbers
      : reservation.roomNumber
      ? [reservation.roomNumber]
      : [];

    rooms.forEach((room) => {
      const roomKey = Number(room);
      if (!conflicts[roomKey]) {
        conflicts[roomKey] = [];
      }
      conflicts[roomKey].push({
        id: reservation.id,
        guestName: reservation.guestName,
        agencyGroupName: reservation.agencyGroupName,
        isGroup: reservation.isGroup,
        status: reservation.status,
        checkInDate: start,
        checkOutDate: end,
      });
    });
  });

  const availableRooms = ALL_ROOMS.filter((room) => !conflicts[room] || conflicts[room].length === 0);
  return { conflicts, availableRooms };
};

function ReservationWizard({
  title = 'Nuova Prenotazione',
  onSubmit,
  onCancel,
  onSuccess,
  context = 'page',
}) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reservations, setReservations] = useState([]);

  const [state, setState] = useState({
    isGroup: false,
    guestName: '',
    agencyGroupName: '',
    phoneNumber: '',
    status: 'in_attesa',
    paymentCompleted: false,
    checkInDate: '',
    checkOutDate: '',
    roomNumbers: [],
    roomCustomNames: {},
    groupPerRoomRates: {},
    groupUniformPerNight: '',
    groupTotalForStay: '',
    singlePricePerNight: '',
    singleTotalPrice: '',
    singlePricingMode: 'perNight',
    groupPricingMode: 'perNightPerRoom',
    singleExtras: {
      petAllowed: false,
      extraBar: '',
      extraServizi: '',
      crib: false,
    },
    groupExtras: {},
    groupCribs: {},
    guestsArrived: {},
    totalPeople: 0,
    totalPeopleManuallyEdited: false,
    lastAutoTotalPeople: 0,
    deposit: '',
    customPrice: '',
    additionalNotes: '',
  });

  useEffect(() => {
    const reservationsRef = collection(db, 'reservations');
    const unsubscribe = onSnapshot(reservationsRef, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      setReservations(data);
    });

    return () => unsubscribe();
  }, []);

  const nights = useMemo(
    () => calculateNights(state.checkInDate, state.checkOutDate),
    [state.checkInDate, state.checkOutDate]
  );

  const { conflicts, availableRooms } = useMemo(
    () => buildConflictMap(reservations, state.checkInDate, state.checkOutDate),
    [reservations, state.checkInDate, state.checkOutDate]
  );

  useEffect(() => {
    setState((prev) => {
      const updatedCustomNames = { ...prev.roomCustomNames };
      const updatedRates = { ...prev.groupPerRoomRates };
      const updatedExtras = { ...prev.groupExtras };
      const updatedCribs = { ...prev.groupCribs };
      const updatedArrivals = { ...prev.guestsArrived };

      prev.roomNumbers.forEach((room) => {
        if (updatedCustomNames[room] === undefined) {
          updatedCustomNames[room] = '';
        }
        if (updatedRates[room] === undefined) {
          updatedRates[room] = '';
        }
        if (!updatedExtras[room]) {
          updatedExtras[room] = { petAllowed: false, extraBar: '', extraServizi: '' };
        }
        if (updatedCribs[room] === undefined) {
          updatedCribs[room] = false;
        }
        if (updatedArrivals[room] === undefined) {
          updatedArrivals[room] = false;
        }
      });

      Object.keys(updatedCustomNames).forEach((roomKey) => {
        const numericRoom = Number(roomKey);
        if (!prev.roomNumbers.includes(numericRoom)) {
          delete updatedCustomNames[numericRoom];
          delete updatedRates[numericRoom];
          delete updatedExtras[numericRoom];
          delete updatedCribs[numericRoom];
          delete updatedArrivals[numericRoom];
        }
      });

      return {
        ...prev,
        roomCustomNames: updatedCustomNames,
        groupPerRoomRates: updatedRates,
        groupExtras: updatedExtras,
        groupCribs: updatedCribs,
        guestsArrived: updatedArrivals,
      };
    });
  }, [state.roomNumbers]);

  useEffect(() => {
    const totalCapacity = state.roomNumbers.reduce((acc, roomNumber) => {
      const type = ROOM_TYPES[roomNumber];
      const capacity = ROOM_CAPACITIES[type] || 0;
      return acc + capacity;
    }, 0);

    setState((prev) => {
      if (prev.totalPeopleManuallyEdited) {
        return { ...prev, lastAutoTotalPeople: totalCapacity };
      }
      return {
        ...prev,
        totalPeople: totalCapacity,
        lastAutoTotalPeople: totalCapacity,
      };
    });
  }, [state.roomNumbers]);

  const basePrice = useMemo(() => {
    if (nights === 0 && state.groupPricingMode !== 'totalForStay' && state.singlePricingMode === 'perNight') {
      return 0;
    }

    if (state.isGroup) {
      if (state.groupPricingMode === 'totalForStay') {
        return N(state.groupTotalForStay);
      }
      if (state.groupPricingMode === 'perNightUniform') {
        const perNight = N(state.groupUniformPerNight);
        return perNight > 0 ? perNight * nights * state.roomNumbers.length : 0;
      }
      if (state.groupPricingMode === 'perNightPerRoom') {
        return state.roomNumbers.reduce((acc, room) => acc + N(state.groupPerRoomRates[room]) * nights, 0);
      }
      return 0;
    }

    if (state.singlePricingMode === 'perNight') {
      const perNight = N(state.singlePricePerNight);
      return perNight > 0 ? perNight * nights : 0;
    }

    if (state.singlePricingMode === 'total') {
      return N(state.singleTotalPrice);
    }

    return 0;
  }, [state, nights]);

  const extrasTotal = useMemo(() => {
    if (state.isGroup) {
      return state.roomNumbers.reduce((acc, room) => {
        const extras = state.groupExtras[room] || {};
        const bar = N(extras.extraBar);
        const servizi = N(extras.extraServizi);
        const pet = extras.petAllowed ? PET_EXTRA : 0;
        const crib = state.groupCribs[room] ? CRIB_EXTRA : 0;
        return acc + bar + servizi + pet + crib;
      }, 0);
    }

    const extras = state.singleExtras;
    const bar = N(extras.extraBar);
    const servizi = N(extras.extraServizi);
    const pet = extras.petAllowed ? PET_EXTRA : 0;
    const crib = extras.crib ? CRIB_EXTRA : 0;
    return bar + servizi + pet + crib;
  }, [state]);

  const priceWithoutExtras = useMemo(() => Math.round(basePrice * 100) / 100, [basePrice]);
  const priceWithExtras = useMemo(
    () => Math.round((basePrice + extrasTotal) * 100) / 100,
    [basePrice, extrasTotal]
  );

  const finalPrice = useMemo(() => {
    if (state.customPrice !== '' && state.customPrice !== null) {
      const custom = N(state.customPrice);
      return Math.round(custom * 100) / 100;
    }
    return priceWithExtras;
  }, [state.customPrice, priceWithExtras]);

  const amountDue = useMemo(() => {
    const deposit = N(state.deposit);
    return Math.max(0, Math.round((finalPrice - deposit) * 100) / 100);
  }, [finalPrice, state.deposit]);

  const handleChange = (field, value) => {
    setState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSingleExtraChange = (field, value) => {
    setState((prev) => ({
      ...prev,
      singleExtras: {
        ...prev.singleExtras,
        [field]: value,
      },
    }));
  };

  const handleGroupExtraChange = (room, field, value) => {
    setState((prev) => ({
      ...prev,
      groupExtras: {
        ...prev.groupExtras,
        [room]: {
          ...prev.groupExtras[room],
          [field]: value,
        },
      },
    }));
  };

  const handleRoomToggle = (room) => {
    setState((prev) => {
      const alreadySelected = prev.roomNumbers.includes(room);
      if (alreadySelected) {
        return {
          ...prev,
          roomNumbers: prev.roomNumbers.filter((num) => num !== room),
        };
      }

      if (!prev.isGroup && prev.roomNumbers.length >= 1) {
        return {
          ...prev,
          roomNumbers: [room],
        };
      }

      return {
        ...prev,
        roomNumbers: [...prev.roomNumbers, room].sort((a, b) => a - b),
      };
    });
  };

  const handlePricingModeChange = (mode) => {
    setState((prev) => ({
      ...prev,
      singlePricingMode: mode,
      singlePricePerNight: mode === 'perNight' ? prev.singlePricePerNight : '',
      singleTotalPrice: mode === 'total' ? prev.singleTotalPrice : '',
    }));
  };

  const handleGroupPricingModeChange = (mode) => {
    setState((prev) => ({
      ...prev,
      groupPricingMode: mode,
    }));
  };

  const handleTotalPeopleChange = (value) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      handleChange('totalPeople', 0);
      return;
    }
    setState((prev) => ({
      ...prev,
      totalPeople: numeric,
      totalPeopleManuallyEdited: true,
    }));
  };

  const resetTotalPeopleToAuto = () => {
    setState((prev) => ({
      ...prev,
      totalPeople: prev.lastAutoTotalPeople || 0,
      totalPeopleManuallyEdited: false,
    }));
  };

  const validateStep = (currentStep) => {
    if (currentStep === 0) {
      if (state.isGroup) {
        if (!state.agencyGroupName.trim()) {
          setError('Inserisci il nome dell\'agenzia o del gruppo.');
          return false;
        }
      } else if (!state.guestName.trim()) {
        setError('Inserisci il nome dell\'ospite principale.');
        return false;
      }
      setError('');
      return true;
    }

    if (currentStep === 1) {
      if (!state.checkInDate || !state.checkOutDate) {
        setError('Seleziona date di check-in e check-out valide.');
        return false;
      }
      if (nights <= 0) {
        setError('La data di check-out deve essere successiva al check-in.');
        return false;
      }
      if (state.roomNumbers.length === 0) {
        setError('Seleziona almeno una camera disponibile.');
        return false;
      }
      if (!state.isGroup && state.roomNumbers.length > 1) {
        setError('Le prenotazioni singole possono includere una sola camera.');
        return false;
      }
      const hasConflict = state.roomNumbers.some((room) => conflicts[room] && conflicts[room].length > 0);
      if (hasConflict) {
        setError('Una o più camere selezionate non sono disponibili nelle date indicate.');
        return false;
      }
      setError('');
      return true;
    }

    if (currentStep === 2) {
      if (state.isGroup) {
        if (state.groupPricingMode === 'totalForStay' && N(state.groupTotalForStay) <= 0) {
          setError('Inserisci il totale soggiorno per il gruppo.');
          return false;
        }
        if (state.groupPricingMode === 'perNightUniform' && N(state.groupUniformPerNight) <= 0) {
          setError('Inserisci il prezzo per notte da applicare alle camere del gruppo.');
          return false;
        }
        if (state.groupPricingMode === 'perNightPerRoom') {
          const missing = state.roomNumbers.some((room) => N(state.groupPerRoomRates[room]) <= 0);
          if (missing) {
            setError('Definisci il prezzo per notte per ogni camera del gruppo.');
            return false;
          }
        }
      } else {
        if (state.singlePricingMode === 'perNight' && N(state.singlePricePerNight) <= 0) {
          setError('Inserisci un prezzo per notte valido.');
          return false;
        }
        if (state.singlePricingMode === 'total' && N(state.singleTotalPrice) <= 0) {
          setError('Inserisci il totale soggiorno.');
          return false;
        }
      }
      if (priceWithoutExtras <= 0) {
        setError('Il prezzo calcolato deve essere maggiore di zero.');
        return false;
      }
      if (N(state.deposit) < 0) {
        setError('La caparra non può essere negativa.');
        return false;
      }
      setError('');
      return true;
    }

    if (currentStep === 3) {
      if (finalPrice <= 0) {
        setError('Definisci un prezzo finale valido prima di confermare.');
        return false;
      }
      setError('');
      return true;
    }

    return true;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, STEP_LABELS.length - 1));
    }
  };

  const prevStep = () => {
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) {
      return;
    }

    if (!onSubmit) return;

    const checkInDate = new Date(state.checkInDate);
    const checkOutDate = new Date(state.checkOutDate);

    const roomPrices = {};
    if (state.isGroup) {
      if (state.groupPricingMode === 'perNightPerRoom') {
        state.roomNumbers.forEach((room) => {
          roomPrices[room] = N(state.groupPerRoomRates[room]);
        });
      } else if (state.groupPricingMode === 'perNightUniform') {
        state.roomNumbers.forEach((room) => {
          roomPrices[room] = N(state.groupUniformPerNight);
        });
      } else if (state.groupPricingMode === 'totalForStay') {
        const divisor = nights * Math.max(state.roomNumbers.length, 1);
        const perRoom = divisor > 0 ? N(state.groupTotalForStay) / divisor : 0;
        state.roomNumbers.forEach((room) => {
          roomPrices[room] = Math.round(perRoom * 100) / 100;
        });
      }
    }

    const pricingMode = state.isGroup ? state.groupPricingMode : state.singlePricingMode;
    const singlePricing = state.isGroup
      ? null
      : {
          mode: state.singlePricingMode,
          pricePerNight: state.singlePricingMode === 'perNight' ? N(state.singlePricePerNight) : null,
          totalForStay: state.singlePricingMode === 'total' ? N(state.singleTotalPrice) : null,
        };
    const groupPricing = state.isGroup
      ? {
          mode: state.groupPricingMode,
          perRoomRates:
            state.groupPricingMode === 'perNightPerRoom'
              ? state.roomNumbers.reduce((acc, room) => {
                  acc[room] = N(state.groupPerRoomRates[room]);
                  return acc;
                }, {})
              : {},
          uniformPerNight:
            state.groupPricingMode === 'perNightUniform' ? N(state.groupUniformPerNight) : null,
          totalForStay: state.groupPricingMode === 'totalForStay' ? N(state.groupTotalForStay) : null,
        }
      : null;
    const finalPriceOverride = state.customPrice !== '' && state.customPrice !== null
      ? N(state.customPrice)
      : null;

    const payload = {
      isGroup: state.isGroup,
      agencyGroupName: state.isGroup ? state.agencyGroupName.trim() : '',
      guestName: state.isGroup ? state.agencyGroupName.trim() : state.guestName.trim(),
      phoneNumber: state.phoneNumber.trim(),
      status: state.status,
      paymentCompleted: state.paymentCompleted,
      checkInDate,
      checkOutDate,
      roomNumbers: state.roomNumbers,
      roomCustomNames: state.isGroup ? state.roomCustomNames : {},
      roomPrices,
      priceWithoutExtras,
      priceWithExtras,
      price: finalPrice,
      deposit: N(state.deposit),
      pricingMode,
      singlePricing,
      groupPricing,
      finalPriceOverride,
      totalPeople: N(state.totalPeople),
      additionalNotes: state.additionalNotes.trim(),
      extraPerRoom: state.isGroup
        ? state.roomNumbers.reduce((acc, room) => {
            const extras = state.groupExtras[room] || {};
            acc[room] = {
              extraBar: N(extras.extraBar),
              extraServizi: N(extras.extraServizi),
              petAllowed: !!extras.petAllowed,
            };
            return acc;
          }, {})
        : {
            extraBar: N(state.singleExtras.extraBar),
            extraServizi: N(state.singleExtras.extraServizi),
            petAllowed: !!state.singleExtras.petAllowed,
          },
      roomCribs: state.isGroup
        ? state.roomNumbers.reduce((acc, room) => {
            acc[room] = !!state.groupCribs[room];
            return acc;
          }, {})
        : !!state.singleExtras.crib,
      guestsArrived: state.isGroup
        ? state.roomNumbers.reduce((acc, room) => {
            acc[room] = !!state.guestsArrived[room];
            return acc;
          }, {})
        : {},
    };

    setLoading(true);
    setError('');
    try {
      await onSubmit(payload);
      if (onSuccess) {
        onSuccess(payload);
      }
    } catch (err) {
      setError(err?.message || 'Errore durante il salvataggio della prenotazione.');
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className={`wizard-steps ${context === 'drawer' ? 'wizard-steps--compact' : ''}`}>
      {STEP_LABELS.map((label, index) => (
        <div
          key={label}
          className={`wizard-step ${index === step ? 'wizard-step--active' : ''} ${
            index < step ? 'wizard-step--completed' : ''
          }`}
        >
          <div className="wizard-step__index">{index + 1}</div>
          <div className="wizard-step__label">{label}</div>
        </div>
      ))}
    </div>
  );

  const renderGeneralStep = () => (
    <div className="wizard-section">
      <div className="wizard-grid">
        <div className="wizard-card">
          <h3>Tipologia prenotazione</h3>
          <div className="wizard-radio-group">
            <label>
              <input
                type="radio"
                checked={!state.isGroup}
                onChange={() =>
                  setState((prev) => ({
                    ...prev,
                    isGroup: false,
                    roomNumbers: prev.roomNumbers.slice(0, 1),
                  }))
                }
              />
              Prenotazione singola
            </label>
            <label>
              <input
                type="radio"
                checked={state.isGroup}
                onChange={() => setState((prev) => ({ ...prev, isGroup: true }))}
              />
              Prenotazione di gruppo / agenzia
            </label>
          </div>
        </div>

        <div className="wizard-card">
          <h3>Dati intestatario</h3>
          {state.isGroup ? (
            <div className="form-group">
              <label htmlFor="agencyGroupName">Nome agenzia / gruppo *</label>
              <input
                id="agencyGroupName"
                type="text"
                value={state.agencyGroupName}
                onChange={(e) => handleChange('agencyGroupName', e.target.value)}
                placeholder="Es. Agenzia Viaggi Blu"
              />
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="guestName">Nome ospite principale *</label>
              <input
                id="guestName"
                type="text"
                value={state.guestName}
                onChange={(e) => handleChange('guestName', e.target.value)}
                placeholder="Nome e cognome"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="phoneNumber">Telefono</label>
            <input
              id="phoneNumber"
              type="tel"
              value={state.phoneNumber}
              onChange={(e) => handleChange('phoneNumber', e.target.value)}
              placeholder="Contatto telefonico"
            />
          </div>
        </div>

        <div className="wizard-card">
          <h3>Stato amministrativo</h3>
          <div className="form-group">
            <label htmlFor="status">Stato prenotazione</label>
            <select
              id="status"
              value={state.status}
              onChange={(e) => handleChange('status', e.target.value)}
            >
              {RESERVATION_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group checkbox">
            <input
              id="paymentCompleted"
              type="checkbox"
              checked={state.paymentCompleted}
              onChange={(e) => handleChange('paymentCompleted', e.target.checked)}
            />
            <label htmlFor="paymentCompleted">Pagamento già completato</label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStayStep = () => (
    <div className="wizard-section">
      <div className="wizard-grid">
        <div className="wizard-card">
          <h3>Date soggiorno</h3>
          <div className="form-group">
            <label htmlFor="checkInDate">Check-in *</label>
            <input
              id="checkInDate"
              type="date"
              value={state.checkInDate}
              onChange={(e) => handleChange('checkInDate', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="checkOutDate">Check-out *</label>
            <input
              id="checkOutDate"
              type="date"
              value={state.checkOutDate}
              onChange={(e) => handleChange('checkOutDate', e.target.value)}
            />
          </div>
          <div className="wizard-info">
            {nights > 0 ? `${nights} notte${nights > 1 ? 'i' : ''} di soggiorno` : 'Definisci le date per calcolare le notti'}
          </div>
        </div>

        <div className="wizard-card">
          <h3>Camere disponibili</h3>
          <div className="room-selection">
            {ALL_ROOMS.map((room) => {
              const isConflicting = !!(conflicts[room] && conflicts[room].length > 0);
              const isSelected = state.roomNumbers.includes(room);
              return (
                <label key={room} className={`room-option ${isConflicting ? 'room-option--disabled' : ''}`}>
                  <input
                    type="checkbox"
                    disabled={isConflicting}
                    checked={isSelected}
                    onChange={() => handleRoomToggle(room)}
                  />
                  <div>
                    <div className="room-option__title">Camera {room}</div>
                    <div className="room-option__subtitle">{ROOM_TYPES[room]}</div>
                    {isConflicting && (
                      <div className="room-option__warning">
                        Occupata: {conflicts[room][0].guestName || conflicts[room][0].agencyGroupName}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
          <div className="wizard-info">
            {availableRooms.length === 0 && nights > 0
              ? 'Nessuna camera disponibile nelle date selezionate.'
              : `${availableRooms.length} camera${availableRooms.length !== 1 ? 'e' : ''} libere`}
          </div>
        </div>

        <div className="wizard-card">
          <h3>Occupazione</h3>
          <div className="form-group">
            <label htmlFor="totalPeople">Numero ospiti</label>
            <input
              id="totalPeople"
              type="number"
              min={0}
              value={state.totalPeople}
              onChange={(e) => handleTotalPeopleChange(e.target.value)}
            />
          </div>
          <button type="button" className="btn btn--ghost" onClick={resetTotalPeopleToAuto}>
            Allinea alla capacità camere
          </button>
          {state.isGroup && state.roomNumbers.length > 0 && (
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>Intestatari camere (opzionale)</label>
              {state.roomNumbers.map((room) => (
                <div key={room} className="form-group inline">
                  <span className="inline-label">Camera {room}</span>
                  <input
                    type="text"
                    value={state.roomCustomNames[room] || ''}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        roomCustomNames: {
                          ...prev.roomCustomNames,
                          [room]: e.target.value,
                        },
                      }))
                    }
                    placeholder="Nome assegnato"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderPricingStep = () => (
    <div className="wizard-section">
      <div className="wizard-grid">
        <div className="wizard-card">
          <h3>Metodo di calcolo</h3>
          {state.isGroup ? (
            <div className="wizard-radio-group">
              <label>
                <input
                  type="radio"
                  checked={state.groupPricingMode === 'perNightPerRoom'}
                  onChange={() => handleGroupPricingModeChange('perNightPerRoom')}
                />
                Prezzo per notte per camera
              </label>
              <label>
                <input
                  type="radio"
                  checked={state.groupPricingMode === 'perNightUniform'}
                  onChange={() => handleGroupPricingModeChange('perNightUniform')}
                />
                Prezzo per notte uguale per tutte le camere
              </label>
              <label>
                <input
                  type="radio"
                  checked={state.groupPricingMode === 'totalForStay'}
                  onChange={() => handleGroupPricingModeChange('totalForStay')}
                />
                Totale complessivo per il soggiorno
              </label>
            </div>
          ) : (
            <div className="wizard-radio-group">
              <label>
                <input
                  type="radio"
                  checked={state.singlePricingMode === 'perNight'}
                  onChange={() => handlePricingModeChange('perNight')}
                />
                Prezzo per notte
              </label>
              <label>
                <input
                  type="radio"
                  checked={state.singlePricingMode === 'total'}
                  onChange={() => handlePricingModeChange('total')}
                />
                Totale soggiorno
              </label>
            </div>
          )}

          {state.isGroup ? (
            <div className="wizard-card__content">
              {state.groupPricingMode === 'perNightPerRoom' && (
                <div className="form-group">
                  <label>Prezzo per notte per camera *</label>
                  {state.roomNumbers.map((room) => (
                    <div key={room} className="form-group inline">
                      <span className="inline-label">Camera {room}</span>
                      <input
                        type="number"
                        min={0}
                        value={state.groupPerRoomRates[room] || ''}
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            groupPerRoomRates: {
                              ...prev.groupPerRoomRates,
                              [room]: e.target.value,
                            },
                          }))
                        }
                        placeholder="€/notte"
                      />
                    </div>
                  ))}
                </div>
              )}

              {state.groupPricingMode === 'perNightUniform' && (
                <div className="form-group">
                  <label htmlFor="groupUniformPerNight">Prezzo per notte per camera *</label>
                  <input
                    id="groupUniformPerNight"
                    type="number"
                    min={0}
                    value={state.groupUniformPerNight}
                    onChange={(e) => handleChange('groupUniformPerNight', e.target.value)}
                    placeholder="€/notte"
                  />
                </div>
              )}

              {state.groupPricingMode === 'totalForStay' && (
                <div className="form-group">
                  <label htmlFor="groupTotalForStay">Totale soggiorno *</label>
                  <input
                    id="groupTotalForStay"
                    type="number"
                    min={0}
                    value={state.groupTotalForStay}
                    onChange={(e) => handleChange('groupTotalForStay', e.target.value)}
                    placeholder="Totale complessivo"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="wizard-card__content">
              {state.singlePricingMode === 'perNight' && (
                <div className="form-group">
                  <label htmlFor="singlePricePerNight">Prezzo per notte *</label>
                  <input
                    id="singlePricePerNight"
                    type="number"
                    min={0}
                    value={state.singlePricePerNight}
                    onChange={(e) => handleChange('singlePricePerNight', e.target.value)}
                    placeholder="€/notte"
                  />
                </div>
              )}
              {state.singlePricingMode === 'total' && (
                <div className="form-group">
                  <label htmlFor="singleTotalPrice">Totale soggiorno *</label>
                  <input
                    id="singleTotalPrice"
                    type="number"
                    min={0}
                    value={state.singleTotalPrice}
                    onChange={(e) => handleChange('singleTotalPrice', e.target.value)}
                    placeholder="Totale complessivo"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="wizard-card">
          <h3>Extra e servizi</h3>
          {state.isGroup ? (
            <div className="wizard-card__content">
              {state.roomNumbers.length === 0 && <p>Seleziona le camere per configurare gli extra.</p>}
              {state.roomNumbers.map((room) => (
                <div key={room} className="extra-room">
                  <div className="extra-room__header">
                    <div>
                      <strong>Camera {room}</strong>
                      <span>{ROOM_TYPES[room]}</span>
                    </div>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={state.groupCribs[room] || false}
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            groupCribs: {
                              ...prev.groupCribs,
                              [room]: e.target.checked,
                            },
                          }))
                        }
                      />
                      Culla (+{formatCurrency(CRIB_EXTRA)})
                    </label>
                  </div>
                  <div className="extra-room__grid">
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={state.groupExtras[room]?.petAllowed || false}
                        onChange={(e) => handleGroupExtraChange(room, 'petAllowed', e.target.checked)}
                      />
                      Animali (+{formatCurrency(PET_EXTRA)})
                    </label>
                    <div className="form-group">
                      <label>Extra Bar</label>
                      <input
                        type="number"
                        min={0}
                        value={state.groupExtras[room]?.extraBar || ''}
                        onChange={(e) => handleGroupExtraChange(room, 'extraBar', e.target.value)}
                        placeholder="€"
                      />
                    </div>
                    <div className="form-group">
                      <label>Extra Servizi</label>
                      <input
                        type="number"
                        min={0}
                        value={state.groupExtras[room]?.extraServizi || ''}
                        onChange={(e) => handleGroupExtraChange(room, 'extraServizi', e.target.value)}
                        placeholder="€"
                      />
                    </div>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={state.guestsArrived[room] || false}
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            guestsArrived: {
                              ...prev.guestsArrived,
                              [room]: e.target.checked,
                            },
                          }))
                        }
                      />
                      Ospiti già arrivati
                    </label>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="wizard-card__content">
              <div className="checkbox">
                <input
                  id="singleExtraPet"
                  type="checkbox"
                  checked={state.singleExtras.petAllowed}
                  onChange={(e) => handleSingleExtraChange('petAllowed', e.target.checked)}
                />
                <label htmlFor="singleExtraPet">Animali (+{formatCurrency(PET_EXTRA)})</label>
              </div>
              <div className="checkbox">
                <input
                  id="singleExtraCrib"
                  type="checkbox"
                  checked={state.singleExtras.crib}
                  onChange={(e) => handleSingleExtraChange('crib', e.target.checked)}
                />
                <label htmlFor="singleExtraCrib">Culla (+{formatCurrency(CRIB_EXTRA)})</label>
              </div>
              <div className="form-group">
                <label htmlFor="singleExtraBar">Extra Bar</label>
                <input
                  id="singleExtraBar"
                  type="number"
                  min={0}
                  value={state.singleExtras.extraBar}
                  onChange={(e) => handleSingleExtraChange('extraBar', e.target.value)}
                  placeholder="€"
                />
              </div>
              <div className="form-group">
                <label htmlFor="singleExtraServizi">Extra Servizi</label>
                <input
                  id="singleExtraServizi"
                  type="number"
                  min={0}
                  value={state.singleExtras.extraServizi}
                  onChange={(e) => handleSingleExtraChange('extraServizi', e.target.value)}
                  placeholder="€"
                />
              </div>
            </div>
          )}
        </div>

        <div className="wizard-card">
          <h3>Totali</h3>
          <div className="totals-grid">
            <div>
              <span>Prezzo base</span>
              <strong>{formatCurrency(priceWithoutExtras)}</strong>
            </div>
            <div>
              <span>Extra</span>
              <strong>{formatCurrency(extrasTotal)}</strong>
            </div>
            <div>
              <span>Totale suggerito</span>
              <strong>{formatCurrency(priceWithExtras)}</strong>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="customPrice">Prezzo finale (opzionale)</label>
            <input
              id="customPrice"
              type="number"
              min={0}
              value={state.customPrice}
              onChange={(e) => handleChange('customPrice', e.target.value)}
              placeholder="Imposta un prezzo finale personalizzato"
            />
            <small>Se compilato, verrà salvato come totale finale.</small>
          </div>
          <div className="form-group">
            <label htmlFor="deposit">Caparra ricevuta</label>
            <input
              id="deposit"
              type="number"
              min={0}
              value={state.deposit}
              onChange={(e) => handleChange('deposit', e.target.value)}
              placeholder="€"
            />
          </div>
          <div className="totals-grid">
            <div>
              <span>Da incassare</span>
              <strong>{formatCurrency(amountDue)}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="wizard-section">
      <div className="wizard-grid">
        <div className="wizard-card">
          <h3>Riepilogo intestazione</h3>
          <ul className="review-list">
            <li>
              <span>Tipologia</span>
              <strong>{state.isGroup ? 'Gruppo / Agenzia' : 'Singola'}</strong>
            </li>
            <li>
              <span>Intestatario</span>
              <strong>{state.isGroup ? state.agencyGroupName : state.guestName}</strong>
            </li>
            <li>
              <span>Telefono</span>
              <strong>{state.phoneNumber || '—'}</strong>
            </li>
            <li>
              <span>Stato</span>
              <strong>{RESERVATION_STATUSES.find((s) => s.value === state.status)?.label || state.status}</strong>
            </li>
            <li>
              <span>Pagamento</span>
              <strong>{state.paymentCompleted ? 'Saldo completo' : 'Da incassare'}</strong>
            </li>
          </ul>
        </div>

        <div className="wizard-card">
          <h3>Riepilogo soggiorno</h3>
          <ul className="review-list">
            <li>
              <span>Date</span>
              <strong>
                {state.checkInDate && state.checkOutDate
                  ? `${new Date(state.checkInDate).toLocaleDateString('it-IT')} → ${new Date(state.checkOutDate).toLocaleDateString(
                      'it-IT'
                    )}`
                  : '—'}
              </strong>
            </li>
            <li>
              <span>Notti</span>
              <strong>{nights}</strong>
            </li>
            <li>
              <span>Camere</span>
              <strong>
                {state.roomNumbers.length > 0
                  ? state.roomNumbers.map((room) => `#${room}`).join(', ')
                  : '—'}
              </strong>
            </li>
            <li>
              <span>Ospiti</span>
              <strong>{state.totalPeople}</strong>
            </li>
          </ul>
          {state.isGroup && state.roomNumbers.length > 0 && (
            <div className="review-subcard">
              <h4>Camere e assegnazioni</h4>
              <ul>
                {state.roomNumbers.map((room) => (
                  <li key={room}>
                    <strong>Camera {room}</strong> — {ROOM_TYPES[room]}
                    {state.roomCustomNames[room] && ` · ${state.roomCustomNames[room]}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="wizard-card">
          <h3>Economica</h3>
          <ul className="review-list">
            <li>
              <span>Prezzo base</span>
              <strong>{formatCurrency(priceWithoutExtras)}</strong>
            </li>
            <li>
              <span>Extra</span>
              <strong>{formatCurrency(extrasTotal)}</strong>
            </li>
            <li>
              <span>Totale finale</span>
              <strong>{formatCurrency(finalPrice)}</strong>
            </li>
            <li>
              <span>Caparra</span>
              <strong>{formatCurrency(N(state.deposit))}</strong>
            </li>
            <li>
              <span>Da incassare</span>
              <strong>{formatCurrency(amountDue)}</strong>
            </li>
          </ul>
          <div className="form-group">
            <label htmlFor="additionalNotes">Note per il soggiorno</label>
            <textarea
              id="additionalNotes"
              rows={4}
              value={state.additionalNotes}
              onChange={(e) => handleChange('additionalNotes', e.target.value)}
              placeholder="Inserisci comunicazioni importanti..."
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    if (step === 0) return renderGeneralStep();
    if (step === 1) return renderStayStep();
    if (step === 2) return renderPricingStep();
    return renderReviewStep();
  };

  return (
    <div className={`reservation-wizard ${context === 'drawer' ? 'reservation-wizard--drawer' : ''}`}>
      <header className="wizard-header">
        <div>
          <h2>{title}</h2>
          <p>Procedura guidata in quattro passaggi per registrare una prenotazione senza errori.</p>
        </div>
        {onCancel && (
          <button type="button" className="btn btn--secondary" onClick={onCancel}>
            Annulla
          </button>
        )}
      </header>

      {renderStepIndicator()}

      {error && <div className="wizard-error">{error}</div>}

      {renderCurrentStep()}

      <footer className="wizard-footer">
        <div className="wizard-footer__left">
          {step > 0 && (
            <button type="button" className="btn btn--secondary" onClick={prevStep}>
              Indietro
            </button>
          )}
        </div>
        <div className="wizard-footer__right">
          {step < STEP_LABELS.length - 1 ? (
            <button type="button" className="btn btn--primary" onClick={nextStep}>
              Prosegui
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Salvataggio...' : 'Conferma prenotazione'}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

export default ReservationWizard;
