// src/pages/Dashboard.jsx

import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { db } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { subDays, subMonths, subYears, format, isAfter, isBefore, addDays } from 'date-fns';
import { it } from 'date-fns/locale';
import '../styles/Dashboard.css';
import ReportDownload from '../components/ReportDownload';
import DailyRoomStatusButton from '../components/DailyRoomStatusButton';
import { Link } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  TimeScale,
  Title,
  Tooltip,
  Legend
);

/**
 * Mappa dei tipi di camera
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
 * Componente per la dashboard che mostra grafici delle prenotazioni, entrate e spese
 */
function Dashboard() {
  const [reservations, setReservations] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [chartDataBookings, setChartDataBookings] = useState({
    labels: [],
    datasets: [],
  });
  const [chartDataRevenue, setChartDataRevenue] = useState({
    labels: [],
    datasets: [],
  });
  const [chartDataExpenses, setChartDataExpenses] = useState({
    labels: [],
    datasets: [],
  });
  const [chartDataProfit, setChartDataProfit] = useState({
    labels: [],
    datasets: [],
  });
  const [timeFilter, setTimeFilter] = useState('month'); // 'week', 'month', 'year', 'all', 'custom'
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  // **Nuovo stato per il filtro dello stato della prenotazione**
  const [statusFilter, setStatusFilter] = useState('conclusa'); // Stato predefinito

  // Stati per le statistiche
  const [totalBookings, setTotalBookings] = useState(0);
  const [totalRoomsBooked, setTotalRoomsBooked] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const reservationsRef = collection(db, 'reservations');

    // **Modifica della query per includere il filtro dello stato**
    let reservationsQuery;
    if (statusFilter === 'all') {
      reservationsQuery = reservationsRef;
    } else {
      reservationsQuery = query(
        reservationsRef,
        where('status', '==', statusFilter)
      );
    }

    const unsubscribeReservations = onSnapshot(reservationsQuery, (snapshot) => {
      const resData = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setReservations(resData);
    });

    const expensesRef = collection(db, 'expenses');
    const unsubscribeExpenses = onSnapshot(expensesRef, (snapshot) => {
      const expensesData = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setExpenses(expensesData);
    });

    return () => {
      unsubscribeReservations();
      unsubscribeExpenses();
    };
  }, [statusFilter]); // **Aggiunto statusFilter come dipendenza**

  useEffect(() => {
    let filteredReservations = [];
    let filteredExpenses = [];
    const now = new Date();

    // Assicurati che reservations sia definito
    if (reservations.length > 0) {
      // Filtra le prenotazioni in base al filtro temporale
      if (timeFilter === 'week') {
        const lastWeek = subDays(now, 7);
        filteredReservations = reservations.filter((reservation) => {
          const checkInDate = reservation.checkInDate.toDate();
          return checkInDate >= lastWeek && checkInDate <= now;
        });
      } else if (timeFilter === 'month') {
        const lastMonth = subMonths(now, 1);
        filteredReservations = reservations.filter((reservation) => {
          const checkInDate = reservation.checkInDate.toDate();
          return checkInDate >= lastMonth && checkInDate <= now;
        });
      } else if (timeFilter === 'year') {
        const lastYear = subYears(now, 1);
        filteredReservations = reservations.filter((reservation) => {
          const checkInDate = reservation.checkInDate.toDate();
          return checkInDate >= lastYear && checkInDate <= now;
        });
      } else if (timeFilter === 'custom' && startDate && endDate) {
        filteredReservations = reservations.filter((reservation) => {
          const checkInDate = reservation.checkInDate.toDate();
          return (
            isAfter(checkInDate, subDays(startDate, 1)) &&
            isBefore(checkInDate, addDays(endDate, 1))
          );
        });
      } else {
        filteredReservations = reservations;
      }

      // Calcolo delle statistiche
      const roomsBooked = new Set(filteredReservations.map((res) => res.roomNumber)).size;
      setTotalRoomsBooked(roomsBooked);
      setTotalBookings(filteredReservations.length);

      const revenue = filteredReservations.reduce((acc, res) => {
        let extraAmount = 0;
        if (res.extra && typeof res.extra === 'string') {
          const match = res.extra.match(/([\d,.]+)/);
          if (match) {
            extraAmount = parseFloat(match[1].replace(',', '.')) || 0;
          }
        } else if (typeof res.extra === 'number') {
          extraAmount = res.extra;
        }
        return acc + (res.price || 0) + extraAmount;
      }, 0);
      setTotalRevenue(revenue);

      // Filtraggio delle spese
      if (expenses.length > 0) {
        if (timeFilter === 'week') {
          const lastWeek = subDays(now, 7);
          filteredExpenses = expenses.filter((exp) => {
            const expenseDate = exp.date.toDate();
            return expenseDate >= lastWeek && expenseDate <= now;
          });
        } else if (timeFilter === 'month') {
          const lastMonth = subMonths(now, 1);
          filteredExpenses = expenses.filter((exp) => {
            const expenseDate = exp.date.toDate();
            return expenseDate >= lastMonth && expenseDate <= now;
          });
        } else if (timeFilter === 'year') {
          const lastYear = subYears(now, 1);
          filteredExpenses = expenses.filter((exp) => {
            const expenseDate = exp.date.toDate();
            return expenseDate >= lastYear && expenseDate <= now;
          });
        } else if (timeFilter === 'custom' && startDate && endDate) {
          filteredExpenses = expenses.filter((exp) => {
            const expenseDate = exp.date.toDate();
            return (
              isAfter(expenseDate, subDays(startDate, 1)) &&
              isBefore(expenseDate, addDays(endDate, 1))
            );
          });
        } else {
          filteredExpenses = expenses;
        }
      }

      const expensesTotal = filteredExpenses.reduce((acc, exp) => acc + (exp.amount || 0), 0);
      setTotalExpenses(expensesTotal);

      const profit = revenue - expensesTotal;
      setTotalProfit(profit);

      // Aggiornamento dei grafici

      // Prenotazioni per data
      const bookingsByDate = {};
      filteredReservations.forEach((reservation) => {
        const date = format(reservation.checkInDate.toDate(), 'yyyy-MM-dd', {
          locale: it,
        });
        if (bookingsByDate[date]) {
          bookingsByDate[date]++;
        } else {
          bookingsByDate[date] = 1;
        }
      });

      const sortedDates = Object.keys(bookingsByDate).sort();

      const bookingsData = {
        labels: sortedDates,
        datasets: [
          {
            label: 'Numero di Prenotazioni',
            data: sortedDates.map((date) => bookingsByDate[date]),
            backgroundColor: 'rgba(75,192,192,0.6)',
          },
        ],
      };

      setChartDataBookings(bookingsData);

      // Entrate per camera
      const revenueByRoom = {};
      filteredReservations.forEach((reservation) => {
        const room = reservation.roomNumber;
        let extraAmount = 0;
        if (reservation.extra && typeof reservation.extra === 'string') {
          const match = reservation.extra.match(/([\d,.]+)/);
          if (match) {
            extraAmount = parseFloat(match[1].replace(',', '.')) || 0;
          }
        } else if (typeof reservation.extra === 'number') {
          extraAmount = reservation.extra;
        }
        const totalPrice = (reservation.price || 0) + extraAmount;
        if (revenueByRoom[room]) {
          revenueByRoom[room] += totalPrice;
        } else {
          revenueByRoom[room] = totalPrice;
        }
      });

      const revenueRooms = Object.keys(revenueByRoom);
      const revenueAmounts = Object.values(revenueByRoom);

      const revenueData = {
        labels: revenueRooms.map((num) => `Camera ${num}: ${ROOM_TYPES[num]}`),
        datasets: [
          {
            label: 'Entrate (€)',
            data: revenueAmounts,
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
          },
        ],
      };

      setChartDataRevenue(revenueData);

      // Spese per categoria
      const expensesByCategory = {};

      filteredExpenses.forEach((expense) => {
        const category = expense.category || 'Altro';
        if (expensesByCategory[category]) {
          expensesByCategory[category] += expense.amount;
        } else {
          expensesByCategory[category] = expense.amount;
        }
      });

      const expenseCategories = Object.keys(expensesByCategory);
      const expenseAmounts = Object.values(expensesByCategory);

      const expensesData = {
        labels: expenseCategories,
        datasets: [
          {
            label: 'Spese (€)',
            data: expenseAmounts,
            backgroundColor: 'rgba(255, 99, 132, 0.6)',
          },
        ],
      };

      setChartDataExpenses(expensesData);

      // Profitto per grafico
      const profitData = {
        labels: ['Entrate', 'Spese', 'Profitto'],
        datasets: [
          {
            label: 'Profitto (€)',
            data: [revenue, expensesTotal, profit],
            backgroundColor: [
              'rgba(54, 162, 235, 0.6)', // Entrate
              'rgba(255, 99, 132, 0.6)', // Spese
              'rgba(75, 192, 192, 0.6)', // Profitto
            ],
          },
        ],
      };

      setChartDataProfit(profitData);
    }
  }, [reservations, expenses, timeFilter, startDate, endDate]);

  const optionsBookings = {
    responsive: true,
    scales: {
      x: {
        type: 'time',
        time: {
          unit:
            timeFilter === 'week'
              ? 'day'
              : timeFilter === 'month'
              ? 'day'
              : 'month',
          tooltipFormat: 'dd MMM yyyy',
          displayFormats: {
            day: 'dd MMM',
            week: 'dd MMM',
            month: 'MMM yyyy',
          },
        },
        adapters: {
          date: {
            locale: it,
          },
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
    plugins: {
      title: {
        display: true,
        text:
          timeFilter === 'week'
            ? "Prenotazioni nell'Ultima Settimana"
            : timeFilter === 'month'
            ? "Prenotazioni nell'Ultimo Mese"
            : timeFilter === 'year'
            ? "Prenotazioni nell'Ultimo Anno"
            : timeFilter === 'custom'
            ? 'Prenotazioni nel Periodo Selezionato'
            : 'Prenotazioni',
        font: {
          size: 18,
        },
      },
      legend: {
        display: false,
      },
    },
  };

  const optionsRevenue = {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: 'Entrate per Camera',
        font: {
          size: 18,
        },
      },
      legend: {
        position: 'top',
      },
    },
  };

  const optionsExpenses = {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: 'Spese per Categoria',
        font: {
          size: 18,
        },
      },
      legend: {
        position: 'top',
      },
    },
  };

  const optionsProfit = {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: 'Profitto',
        font: {
          size: 18,
        },
      },
      legend: {
        position: 'top',
      },
    },
  };

  return (
    <Layout>
      <div className="page-container">
        <section className="hero-section" aria-labelledby="dashboard-heading">
          <div className="hero-content">
            <p className="hero-eyebrow">Panoramica giornaliera</p>
            <h2 id="dashboard-heading" className="hero-title">Control Center</h2>
            <p className="hero-subtitle">
              Gestisci prenotazioni, occupazione e performance economiche in tempo reale.
            </p>
          </div>
          <div className="hero-actions">
            <DailyRoomStatusButton />
            <Link to="/expenses" className="btn btn--ghost">
              Visualizza Spese
            </Link>
            <Link to="/expenses/add" className="btn btn--primary">
              + Aggiungi Spesa
            </Link>
          </div>
        </section>
        {error && <p className="error-message">{error}</p>}
        <section className="filter-bar">
            <div
              className="filter-buttons"
              role="group"
              aria-label="Intervallo temporale prenotazioni"
            >
              <button
                className={timeFilter === 'week' ? 'active' : ''}
                onClick={() => {
                  setTimeFilter('week');
                  setStartDate(null);
                  setEndDate(null);
                }}
                type="button"
              >
                Ultima Settimana
              </button>
              <button
                className={timeFilter === 'month' ? 'active' : ''}
                onClick={() => {
                  setTimeFilter('month');
                  setStartDate(null);
                  setEndDate(null);
                }}
                type="button"
              >
                Ultimo Mese
              </button>
              <button
                className={timeFilter === 'year' ? 'active' : ''}
                onClick={() => {
                  setTimeFilter('year');
                  setStartDate(null);
                  setEndDate(null);
                }}
                type="button"
              >
                Ultimo Anno
              </button>
              <button
                className={timeFilter === 'all' ? 'active' : ''}
                onClick={() => {
                  setTimeFilter('all');
                  setStartDate(null);
                  setEndDate(null);
                }}
                type="button"
              >
                Tutto
              </button>
              <button
                className={timeFilter === 'custom' ? 'active' : ''}
                onClick={() => setTimeFilter('custom')}
                type="button"
              >
                Personalizzato
              </button>
            </div>
            {timeFilter === 'custom' && (
              <div className="date-pickers">
                <DatePicker
                  selected={startDate}
                  onChange={(date) => setStartDate(date)}
                  selectsStart
                  startDate={startDate}
                  endDate={endDate}
                  placeholderText="Data Inizio"
                  dateFormat="dd/MM/yyyy"
                />
                <DatePicker
                  selected={endDate}
                  onChange={(date) => setEndDate(date)}
                  selectsEnd
                  startDate={startDate}
                  endDate={endDate}
                  minDate={startDate}
                  placeholderText="Data Fine"
                  dateFormat="dd/MM/yyyy"
                />
              </div>
            )}

            {/* **Aggiunta del filtro per lo stato della prenotazione** */}
            <div className="filter-group">
              <label htmlFor="statusFilter">Filtra per Stato Prenotazione:</label>
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="conclusa">Conclusa</option>
                <option value="in_attesa">In Attesa</option>
                <option value="annullata">Annullata</option>
                {/* Aggiungi altre opzioni di stato se necessario */}
                <option value="all">Tutti gli Stati</option>
              </select>
            </div>
        </section>

        {/* Sezione delle statistiche */}
        <section className="stats-grid" aria-label="Indicatori principali">
          <div className="stat-card">
            <p className="stat-label">Camere Prenotate</p>
            <p className="stat-value">{totalRoomsBooked}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Prenotazioni Totali</p>
            <p className="stat-value">{totalBookings}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Fatturato</p>
            <p className="stat-value">€ {totalRevenue.toFixed(2)}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Spese</p>
            <p className="stat-value">€ {totalExpenses.toFixed(2)}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Profitto</p>
            <p className="stat-value">€ {totalProfit.toFixed(2)}</p>
          </div>
        </section>

        {/* Grafici */}
        <section className="charts-container" aria-label="Analisi dati">
          <div className="chart">
            {chartDataBookings.labels.length > 0 && chartDataBookings.datasets.length > 0 ? (
              <Bar data={chartDataBookings} options={optionsBookings} />
            ) : (
              <p>Caricamento dati prenotazioni...</p>
            )}
          </div>
          <div className="chart">
            {chartDataRevenue.labels.length > 0 && chartDataRevenue.datasets.length > 0 ? (
              <Pie data={chartDataRevenue} options={optionsRevenue} />
            ) : (
              <p>Caricamento dati entrate...</p>
            )}
          </div>
          <div className="chart">
            {chartDataExpenses.labels.length > 0 && chartDataExpenses.datasets.length > 0 ? (
              <Pie data={chartDataExpenses} options={optionsExpenses} />
            ) : (
              <p>Caricamento dati spese...</p>
            )}
          </div>
          <div className="chart">
            {chartDataProfit.labels.length > 0 && chartDataProfit.datasets.length > 0 ? (
              <Bar data={chartDataProfit} options={optionsProfit} />
            ) : (
              <p>Caricamento dati profitto...</p>
            )}
          </div>
        </section>

        {/* Componente per il Download del Report */}
        <section className="dashboard-download">
          <ReportDownload reservations={reservations} expenses={expenses} />
        </section>
      </div>
    </Layout>
  );
}

export default Dashboard;
