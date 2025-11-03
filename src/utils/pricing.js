// src/utils/pricing.js
// Centralized pricing logic used across Calendar, Lists and Quick View.

export const PET_EXTRA = 10;
export const CRIB_EXTRA = 10;

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
  let aggregated = {
    extraBar: 0,
    extraServizi: 0,
    pet: 0,
    crib: 0,
  };

  if (isGroup && Array.isArray(reservation?.roomNumbers)) {
    reservation.roomNumbers.forEach((room) => {
      const e = (reservation.extraPerRoom && reservation.extraPerRoom[room]) || {};
      const bar = N(e.extraBar);
      const serv = N(e.extraServizi);
      const pet = e.petAllowed ? PET_EXTRA : 0;
      const crib = reservation.roomCribs && reservation.roomCribs[room] ? CRIB_EXTRA : 0;
      const sum = bar + serv + pet + crib;
      perRoom[room] = { extraBar: bar, extraServizi: serv, petAllowed: !!e.petAllowed, crib: !!(reservation.roomCribs && reservation.roomCribs[room]), total: sum };
      extrasTotal += sum;
      aggregated.extraBar += bar;
      aggregated.extraServizi += serv;
      aggregated.pet += pet;
      aggregated.crib += crib;
    });
  } else {
    const e = reservation?.extraPerRoom || {};
    const bar = N(e.extraBar);
    const serv = N(e.extraServizi);
    const pet = e.petAllowed ? PET_EXTRA : 0;
    const hasCrib = typeof reservation?.roomCribs === 'boolean'
      ? reservation.roomCribs
      : reservation?.roomCribs && typeof reservation.roomCribs === 'object'
        ? Object.values(reservation.roomCribs).some(Boolean)
        : false;
    const crib = hasCrib ? CRIB_EXTRA : 0;
    const sum = bar + serv + pet + crib;
    perRoom['single'] = { extraBar: bar, extraServizi: serv, petAllowed: !!e.petAllowed, crib: hasCrib, total: sum };
    extrasTotal += sum;
    aggregated.extraBar += bar;
    aggregated.extraServizi += serv;
    aggregated.pet += pet;
    aggregated.crib += crib;
  }

  return { perRoom, extrasTotal, aggregated };
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
function formatCurrency(value) {
  return N(value).toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  });
}

function resolvePricingMode(reservation, base, nights) {
  const isGroup = !!reservation?.isGroup;
  const pricingMode = reservation?.pricingMode
    || (!isGroup && reservation?.singlePricing?.mode)
    || (isGroup && reservation?.groupPricing?.mode)
    || (isGroup ? 'perNightPerRoom' : 'perNight');

  if (!isGroup) {
    const mode = pricingMode === 'total' ? 'total' : 'perNight';
    const perNightValue = reservation?.singlePricing?.pricePerNight
      ?? (nights > 0 ? base / nights : 0);
    const totalForStay = reservation?.singlePricing?.totalForStay ?? base;

    return {
      mode,
      label: mode === 'perNight' ? 'Prezzo per notte' : 'Totale soggiorno',
      baseBreakdown: mode === 'perNight' && nights > 0
        ? `${nights} notti × ${formatCurrency(perNightValue)} = ${formatCurrency(base)}`
        : null,
      perNightValue,
      totalForStay,
    };
  }

  const groupMode = pricingMode || 'perNightPerRoom';
  const perRoomRates = reservation?.groupPricing?.perRoomRates || reservation?.roomPrices || {};
  const uniformPerNight = reservation?.groupPricing?.uniformPerNight ?? null;
  const totalForStay = reservation?.groupPricing?.totalForStay ?? base;

  let label = 'Prezzo per notte per camera';
  let breakdown = null;

  if (groupMode === 'perNightUniform') {
    label = 'Prezzo per notte (stesso per tutte le camere)';
    const rate = uniformPerNight ?? (nights > 0 && reservation?.roomNumbers?.length
      ? base / (nights * reservation.roomNumbers.length)
      : 0);
    breakdown = nights > 0 && reservation?.roomNumbers?.length
      ? `${nights} notti × ${reservation.roomNumbers.length} camere × ${formatCurrency(rate)} = ${formatCurrency(base)}`
      : null;
  } else if (groupMode === 'totalForStay') {
    label = 'Totale soggiorno';
    breakdown = `${formatCurrency(totalForStay)}`;
  } else {
    const parts = Array.isArray(reservation?.roomNumbers)
      ? reservation.roomNumbers.map((room) => {
          const rate = perRoomRates?.[room] ?? (nights > 0 ? base / nights / reservation.roomNumbers.length : 0);
          return `Camera ${room}: ${formatCurrency(rate)}`;
        })
      : [];
    breakdown = nights > 0 && parts.length > 0
      ? `${nights} notti × (${parts.join(', ')})`
      : null;
  }

  return {
    mode: groupMode,
    label,
    baseBreakdown: breakdown,
    perRoomRates,
    uniformPerNight,
    totalForStay,
  };
}

export function summarizeReservationPricing(reservation) {
  const { extrasTotal, perRoom, aggregated } = computeExtras(reservation);
  const { base, nights } = computeBase(reservation);
  const savedPrice = N(reservation?.price);
  const deposit = N(reservation?.deposit);
  const priceWithExtras = N(reservation?.priceWithExtras);
  const finalPriceOverride = reservation?.finalPriceOverride !== undefined && reservation?.finalPriceOverride !== null
    ? N(reservation.finalPriceOverride)
    : null;

  const basePlusExtras = base + extrasTotal;

  // Preferred calculated total per dati tecnici
  const calculatedTotal = priceWithExtras > 0 ? priceWithExtras : basePlusExtras;

  const eps = 0.01;
  const finalPriceCandidate = finalPriceOverride !== null
    ? finalPriceOverride
    : (savedPrice > 0 ? savedPrice : calculatedTotal);

  const finalPriceIncludesExtras = Math.abs(finalPriceCandidate - basePlusExtras) < eps;
  const finalPriceMatchesBase = Math.abs(finalPriceCandidate - base) < eps;

  let extrasAppliedToDue = 0;
  if (!finalPriceIncludesExtras && extrasTotal > 0) {
    extrasAppliedToDue = extrasTotal;
  }

  const amountDueBasis = finalPriceCandidate + extrasAppliedToDue;
  const amountDue = Math.max(0, amountDueBasis - deposit);

  const modeInfo = resolvePricingMode(reservation, base, nights);

  const extrasItems = [];
  if (aggregated.extraBar > 0) {
    extrasItems.push({ key: 'extraBar', label: 'Extra bar', amount: aggregated.extraBar });
  }
  if (aggregated.extraServizi > 0) {
    extrasItems.push({ key: 'extraServizi', label: 'Extra servizi', amount: aggregated.extraServizi });
  }
  if (aggregated.pet > 0) {
    extrasItems.push({ key: 'pet', label: 'Animali', amount: aggregated.pet });
  }
  if (aggregated.crib > 0) {
    extrasItems.push({ key: 'crib', label: 'Culla', amount: aggregated.crib });
  }

  return {
    nights,
    base,
    extrasTotal,
    perRoom,
    calculatedTotal,
    savedPrice,
    deposit,
    amountDue,
    finalPrice: finalPriceCandidate,
    finalPriceOverride,
    finalPriceIncludesExtras,
    finalPriceMatchesBase,
    extrasAppliedToDue,
    amountDueBasis,
    pricingMode: modeInfo.mode,
    pricingLabel: modeInfo.label,
    baseBreakdown: modeInfo.baseBreakdown,
    extrasItems,
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
