// src/components/Sidebar.jsx

import React, { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import '../styles/Sidebar.css';

/**
 * Elenco delle camere con i loro tipi
 */
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

/**
 * Mappa dei colori per gli stati delle prenotazioni
 */
const STATUS_COLORS = {
  in_attesa: 'yellow',    // In Attesa
  confermata: 'green',    // Confermata
  annullata: 'red',       // Annullata
  conclusa: 'blue',       // Conclusa
};

/**
 * Mappa delle etichette per gli stati delle prenotazioni
 */
const RESERVATION_STATUS_LABELS = {
  in_attesa: 'In Attesa',
  confermata: 'Confermata',
  annullata: 'Annullata',
  conclusa: 'Conclusa',
};

/**
 * Componente Sidebar con i link di navigazione e stato delle camere
 */
function Sidebar({ isOpen, onNavigate }) {
  const [availableRooms, setAvailableRooms] = useState([]);
  const [reservedRoomsMap, setReservedRoomsMap] = useState({});

  useEffect(() => {
    const reservationsRef = collection(db, 'reservations');
    const unsubscribe = onSnapshot(reservationsRef, (snapshot) => {
      const reservationsData = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const overlappingReservations = reservationsData.filter((reservation) => {
        const checkIn = reservation.checkInDate.toDate();
        const checkOut = reservation.checkOutDate.toDate();

        checkIn.setHours(0, 0, 0, 0);
        checkOut.setHours(0, 0, 0, 0);

        // Verifica se oggi è compreso tra check-in (incluso) e check-out (escluso)
        return checkIn <= today && today < checkOut;
      });

      // Crea una mappa da numero di camera a prenotazione
      const roomToReservation = {};
      overlappingReservations.forEach((reservation) => {
        const rooms = Array.isArray(reservation.roomNumbers) ? reservation.roomNumbers : [reservation.roomNumber];
        rooms.forEach((room) => {
          // Se una camera ha più prenotazioni contemporaneamente, considerarla come occupata
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
    });

    return () => unsubscribe();
  }, []);

  /**
   * Funzione per determinare lo stato della camera
   * @param {number} roomNumber
   * @returns {object} { status: string, color: string }
   */
  const getRoomStatus = (roomNumber) => {
    const reservation = reservedRoomsMap[roomNumber];
    if (reservation) {
      return {
        status: reservation.status,
        color: STATUS_COLORS[reservation.status] || 'grey',
      };
    }
    return { status: 'available', color: 'green' };
  };

  const stats = useMemo(() => {
    const total = Object.keys(ROOM_TYPES).length;
    const occupied = total - availableRooms.length;
    return {
      total,
      occupied,
      available: availableRooms.length,
      occupancyRate: total ? Math.round((occupied / total) * 100) : 0,
    };
  }, [availableRooms.length]);

  return (
    <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
      <div className="sidebar__brand">
        <span className="sidebar__badge">PM</span>
        <div>
          <p className="sidebar__eyebrow">Paradiso delle Madonie</p>
          <h2 className="sidebar__title">Control Center</h2>
        </div>
      </div>

      <nav className="sidebar__nav" aria-label="Principale">
        <NavLink to="/" className={({ isActive }) => (isActive ? 'active' : undefined)} onClick={onNavigate}>
          <span className="sidebar__icon" aria-hidden="true">📊</span>
          Dashboard
        </NavLink>
        <NavLink to="/reservations" className={({ isActive }) => (isActive ? 'active' : undefined)} onClick={onNavigate}>
          <span className="sidebar__icon" aria-hidden="true">🛎️</span>
          Prenotazioni
        </NavLink>
        <NavLink to="/calendar" className={({ isActive }) => (isActive ? 'active' : undefined)} onClick={onNavigate}>
          <span className="sidebar__icon" aria-hidden="true">🗓️</span>
          Calendario
        </NavLink>
        <NavLink to="/expenses" className={({ isActive }) => (isActive ? 'active' : undefined)} onClick={onNavigate}>
          <span className="sidebar__icon" aria-hidden="true">💰</span>
          Spese
        </NavLink>
        <NavLink to="/invoices" className={({ isActive }) => (isActive ? 'active' : undefined)} onClick={onNavigate}>
          <span className="sidebar__icon" aria-hidden="true">📄</span>
          Fatture
        </NavLink>
      </nav>

      <section className="sidebar__panel" aria-labelledby="occupancy-heading">
        <div className="sidebar__panel-header">
          <h3 id="occupancy-heading">Occupazione di oggi</h3>
          <span className="sidebar__chip">{stats.occupancyRate}%</span>
        </div>
        <ul className="sidebar__stats">
          <li>
            <span>Totale</span>
            <strong>{stats.total}</strong>
          </li>
          <li>
            <span>Occupate</span>
            <strong>{stats.total - stats.available}</strong>
          </li>
          <li>
            <span>Libere</span>
            <strong className="sidebar__available">{stats.available}</strong>
          </li>
        </ul>
        <div className="sidebar__legend" aria-label="Legenda stato camere">
          {Object.entries(RESERVATION_STATUS_LABELS).map(([key, label]) => (
            <span key={key}>
              <span className="legend-dot" style={{ backgroundColor: STATUS_COLORS[key] }} aria-hidden="true" />
              {label}
            </span>
          ))}
          <span>
            <span className="legend-dot" style={{ backgroundColor: '#22c55e' }} aria-hidden="true" />
            Disponibile
          </span>
        </div>
      </section>

      <section className="sidebar__panel" aria-labelledby="rooms-heading">
        <div className="sidebar__panel-header">
          <h3 id="rooms-heading">Camere</h3>
        </div>
        <ul className="sidebar__rooms">
          {Object.entries(ROOM_TYPES).map(([number, type]) => {
            const roomNumber = Number(number);
            const { status } = getRoomStatus(roomNumber);
            const isAvailable = status === 'available';

            return (
              <li key={number} className={isAvailable ? 'is-available' : 'is-occupied'}>
                <span className="status-dot" aria-hidden="true" />
                <div>
                  <p className="sidebar__room-name">Camera {number}</p>
                  <p className="sidebar__room-type">{type}</p>
                </div>
                <span className="sidebar__room-status">
                  {isAvailable ? 'Disponibile' : RESERVATION_STATUS_LABELS[status]}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <footer className="sidebar__footer">
        <p>Ultimo aggiornamento in tempo reale</p>
        <button type="button" className="sidebar__support-btn">
          Supporto Concierge
        </button>
      </footer>
    </aside>
  );
}

export default Sidebar;
