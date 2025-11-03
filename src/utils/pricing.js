// src/utils/pricing.js
// Centralized pricing logic used across Calendar, Lists and Quick View.

// Helper: safe number
export const N = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const num = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(num) ? num : 0;
};

const parseDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

// Compute number of nights between two Firestore Timestamps or Date
export function nightsBetween(checkInDate, checkOutDate) {
  try {
    const start = checkInDate?.toDate ? checkInDate.toDate() : new Date(checkInDate);
    const end = checkOutDate?.toDate ? checkOutDate.toDate() : new Date(checkOutDate);
    if (!(start instanceof Date) || isNaN(start) || !(end instanceof Date) || isNaN(end)) return 0;
    const ms = end.setHours(0,0,0,0) - start.setHours(0,0,0,0);
    const d = Math.round(ms / (1000 * 60 * 60 * 24));
    return Math.max(0, d);
  } catch { return 0; }
}

// Compute extras total and per-room breakdown
export function computeExtras(reservation) {
  const isGroup = !!reservation?.isGroup;
  const perRoom = {};
  let extrasTotal = 0;

  if (isGroup && Array.isArray(reservation?.roomNumbers)) {
    reservation.roomNumbers.forEach((room) => {
      const e = (reservation.extraPerRoom && reservation.extraPerRoom[room]) || {};
      const bar = N(e.extraBar);
      const serv = N(e.extraServizi);
      const pet = e.petAllowed ? 10 : 0;
      const crib = reservation.roomCribs && reservation.roomCribs[room] ? 10 : 0;
      const sum = bar + serv + pet + crib;
      perRoom[room] = { extraBar: bar, extraServizi: serv, petAllowed: !!e.petAllowed, crib: !!(reservation.roomCribs && reservation.roomCribs[room]), total: sum };
      extrasTotal += sum;
    });
  } else {
    const e = reservation?.extraPerRoom || {};
    const bar = N(e.extraBar);
    const serv = N(e.extraServizi);
    const pet = e.petAllowed ? 10 : 0;
    const hasCrib = typeof reservation?.roomCribs === 'boolean'
      ? reservation.roomCribs
      : reservation?.roomCribs && typeof reservation.roomCribs === 'object'
        ? Object.values(reservation.roomCribs).some(Boolean)
        : false;
    const crib = hasCrib ? 10 : 0;
    const sum = bar + serv + pet + crib;
    perRoom['single'] = { extraBar: bar, extraServizi: serv, petAllowed: !!e.petAllowed, crib: hasCrib, total: sum };
    extrasTotal += sum;
  }

  return { perRoom, extrasTotal };
}

// Compute base price using roomPrices*nights for groups or priceWithoutExtras otherwise
export function computeBase(reservation) {
  const isGroup = !!reservation?.isGroup;
  const n = nightsBetween(reservation?.checkInDate, reservation?.checkOutDate);
  let base = 0;
  if (isGroup && Array.isArray(reservation?.roomNumbers) && n > 0) {
    base = reservation.roomNumbers.reduce((acc, room) => acc + N(reservation?.roomPrices?.[room]) * n, 0);
  } else {
    base = N(reservation?.priceWithoutExtras);
  }
  return { base, nights: n };
}

// Summarize pricing, deciding whether saved price likely includes extras
export function summarizeReservationPricing(reservation) {
  const { extrasTotal, perRoom } = computeExtras(reservation);
  const { base, nights } = computeBase(reservation);
  const savedPrice = N(reservation?.price);
  const deposit = N(reservation?.deposit);
  const priceWithExtras = N(reservation?.priceWithExtras);

  // Preferred calculated total
  const calculatedTotal = priceWithExtras > 0 ? priceWithExtras : base + extrasTotal;

  // Heuristic to decide if saved price already includes extras
  const eps = 0.01;
  const includesExtras = (
    (priceWithExtras > 0 && Math.abs(savedPrice - priceWithExtras) < eps) ||
    Math.abs(savedPrice - (base + extrasTotal)) < eps ||
    (savedPrice > 0 && extrasTotal === 0) // degenerate but reasonable
  );

  const dueUsingSaved = Math.max(0, savedPrice - deposit);
  const dueUsingCalculated = Math.max(0, calculatedTotal - deposit);

  return {
    nights,
    base,
    extrasTotal,
    perRoom,
    calculatedTotal,
    savedPrice,
    deposit,
    includesExtras,
    dueUsingSaved,
    dueUsingCalculated,
  };
}

// Normalizza i dati del form (Aggiungi / Modifica) in un oggetto compatibile con summarizeReservationPricing
export function buildReservationDraftFromForm(formData = {}) {
  const isGroup = !!formData.isGroup;

  const roomNumbers = Array.isArray(formData.roomNumbers)
    ? formData.roomNumbers
        .map((room) => {
          const num = Number(room);
          return Number.isNaN(num) ? room : num;
        })
        .filter((room) => room !== null && room !== undefined && room !== '')
    : formData.roomNumber
    ? [Number(formData.roomNumber)]
    : [];

  const roomPrices = {};
  Object.entries(formData.roomPrices || {}).forEach(([room, value]) => {
    const key = Number.isNaN(Number(room)) ? room : Number(room);
    roomPrices[key] = N(value);
  });

  let extraPerRoom;
  if (isGroup) {
    extraPerRoom = {};
    roomNumbers.forEach((room) => {
      const roomKey = Number.isNaN(Number(room)) ? room : Number(room);
      const extras = formData.extraPerRoom?.[roomKey] || {};
      extraPerRoom[roomKey] = {
        extraBar: N(extras.extraBar),
        extraServizi: N(extras.extraServizi),
        petAllowed: !!extras.petAllowed,
      };
    });
  } else {
    const extras = formData.extraPerRoom || {};
    extraPerRoom = {
      extraBar: N(extras.extraBar),
      extraServizi: N(extras.extraServizi),
      petAllowed: !!extras.petAllowed,
    };
  }

  const roomCribs = isGroup
    ? Object.fromEntries(
        roomNumbers.map((room) => {
          const key = Number.isNaN(Number(room)) ? room : Number(room);
          return [key, !!(formData.roomCribs ? formData.roomCribs[key] : false)];
        })
      )
    : !!formData.roomCribs;

  const savedPrice =
    formData.customPrice !== undefined && formData.customPrice !== ''
      ? N(formData.customPrice)
      : N(formData.price);

  return {
    isGroup,
    roomNumbers,
    roomPrices,
    extraPerRoom,
    roomCribs,
    price: savedPrice,
    priceWithoutExtras: N(formData.priceWithoutExtras),
    priceWithExtras: N(formData.priceWithExtras),
    deposit: N(formData.deposit),
    checkInDate: parseDate(formData.checkInDate),
    checkOutDate: parseDate(formData.checkOutDate),
  };
}

// ESM exports only
