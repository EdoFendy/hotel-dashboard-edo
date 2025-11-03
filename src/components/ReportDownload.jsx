// src/components/ReportDownload.jsx

import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import Papa from 'papaparse';
import '../styles/ReportDownload.css';

/**
 * Componente per scaricare report delle entrate e delle spese
 */
function ReportDownload({ reservations, expenses }) {
  const [reportType, setReportType] = useState('month'); // 'month', 'year'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // Mesi da 1 a 12

  // Genera una lista di anni disponibili nei dati
  const [availableYears, setAvailableYears] = useState([]);

  useEffect(() => {
    // Filtra solo le prenotazioni concluse
    const concludedReservations = reservations.filter((res) => res.status === 'conclusa');

    // Estrae gli anni dalle prenotazioni concluse e dalle spese
    const reservationYears = concludedReservations.map((res) =>
      res.checkInDate.toDate().getFullYear()
    );
    const expenseYears = expenses.map((exp) => exp.date.toDate().getFullYear());

    // Combina e ottiene gli anni unici
    const years = Array.from(new Set([...reservationYears, ...expenseYears]));

    // Ordina gli anni in ordine decrescente
    years.sort((a, b) => b - a);

    setAvailableYears(years);
  }, [reservations, expenses]);

  /**
   * Mappa delle etichette per gli stati delle prenotazioni
   */
  const RESERVATION_STATUS_LABELS = {
    pending: 'In Attesa',
    confirmed: 'Confermata',
    canceled: 'Annullata',
    completed: 'Conclusa',
    conclusa: 'Conclusa', // Aggiungi 'conclusa' se necessario
  };

  /**
   * Mappa dei colori per gli stati delle prenotazioni
   */
  const STATUS_COLORS = {
    pending: 'yellow',
    confirmed: 'green',
    canceled: 'red',
    completed: 'blue',
    conclusa: 'blue', // Aggiungi colore per 'conclusa' se necessario
  };

  // Funzione per estrarre l'importo extra in base al tipo
  const getExtraAmount = (extra) => {
    if (!extra) return 0;

    if (typeof extra === 'string') {
      const match = extra.match(/([\d,.]+)/);
      if (match) {
        return parseFloat(match[1].replace(',', '.')) || 0;
      }
    } else if (typeof extra === 'number') {
      return extra;
    }

    return 0;
  };

  // Funzione per filtrare i dati in base all'anno/mese selezionato
  const filterReservations = (data) => {
    return data.filter((item) => {
      // Filtra solo le prenotazioni concluse
      if (item.status !== 'conclusa') return false;

      const itemDate = item.checkInDate.toDate();
      const itemYear = itemDate.getFullYear();
      const itemMonth = itemDate.getMonth() + 1; // Mesi da 1 a 12

      if (reportType === 'year') {
        return itemYear === selectedYear;
      } else if (reportType === 'month') {
        return itemYear === selectedYear && itemMonth === selectedMonth;
      } else {
        return true; // Se il tipo di report non è 'year' o 'month', restituisce tutti i dati
      }
    });
  };

  const filterExpenses = (data) => {
    return data.filter((item) => {
      const itemDate = item.date.toDate();
      const itemYear = itemDate.getFullYear();
      const itemMonth = itemDate.getMonth() + 1; // Mesi da 1 a 12

      if (reportType === 'year') {
        return itemYear === selectedYear;
      } else if (reportType === 'month') {
        return itemYear === selectedYear && itemMonth === selectedMonth;
      } else {
        return true; // Se il tipo di report non è 'year' o 'month', restituisce tutti i dati
      }
    });
  };

  const generatePDF = () => {
    const doc = new jsPDF();

    // Filtra i dati
    const filteredReservations = filterReservations(reservations);
    const filteredExpenses = filterExpenses(expenses);

    // Calcola i totali
    const totalRevenue = filteredReservations.reduce((acc, res) => {
      const extraAmount = getExtraAmount(res.extra);
      const price = res.price ? parseFloat(res.price) : 0;
      return acc + price + extraAmount;
    }, 0);

    const totalExpenses = filteredExpenses.reduce(
      (acc, exp) => acc + (exp.amount ? parseFloat(exp.amount) : 0),
      0
    );

    const totalProfit = totalRevenue - totalExpenses;

    // Prepara il testo del periodo del report
    let dateRangeText = '';
    if (reportType === 'year') {
      dateRangeText = `Anno ${selectedYear}`;
    } else if (reportType === 'month') {
      const monthName = new Date(
        selectedYear,
        selectedMonth - 1
      ).toLocaleString('default', { month: 'long' });
      dateRangeText = `${
        monthName.charAt(0).toUpperCase() + monthName.slice(1)
      } ${selectedYear}`;
    } else {
      dateRangeText = 'Tutte le Date';
    }

    // Header
    doc.setFontSize(18);
    doc.text('Report Contabilità Hotel', 14, 22);
    doc.setFontSize(12);
    doc.text(`Data di Generazione: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Periodo del Report: ${dateRangeText}`, 14, 36);

    // Totali
    doc.setFontSize(14);
    doc.text(`Entrate Totali: € ${totalRevenue.toFixed(2)}`, 14, 46);
    doc.text(`Spese Totali: € ${totalExpenses.toFixed(2)}`, 14, 52);
    doc.text(`Guadagno Totale: € ${totalProfit.toFixed(2)}`, 14, 58);

    // Entrate
    doc.setFontSize(12);
    const startY = 68;
    doc.text('Dettaglio Entrate', 14, startY);

    const revenueData = filteredReservations.map((res) => {
      const extraAmount = getExtraAmount(res.extra);
      const price = res.price ? parseFloat(res.price) : 0;
      console.log(`Prenotazione ${res.id}: Prezzo=${price}, Extra=${extraAmount}`);
      return {
        'Nome Ospite': res.guestName || '',
        'Numero Telefono': res.phoneNumber || '',
        'Camera': res.roomNumber || '',
        'Prezzo (€)': price.toFixed(2),
        'Extra (€)': extraAmount.toFixed(2),
        'Stato Prenotazione': RESERVATION_STATUS_LABELS[res.status] || 'In Attesa',
        'Data Check-in': res.checkInDate
          ? res.checkInDate.toDate().toLocaleDateString()
          : '',
        'Data Check-out': res.checkOutDate
          ? res.checkOutDate.toDate().toLocaleDateString()
          : '',
      };
    });

    doc.autoTable({
      startY: startY + 5,
      head: [
        [
          'Nome Ospite',
          'Numero Telefono',
          'Camera',
          'Prezzo (€)',
          'Extra (€)',
          'Stato Prenotazione',
          'Data Check-in',
          'Data Check-out',
        ],
      ],
      body: revenueData.map((row) => Object.values(row)),
    });

    // Spese
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.text('Dettaglio Spese', 14, finalY);
    const expensesData = filteredExpenses.map((exp) => ({
      'Descrizione': exp.description || '',
      'Importo (€)': exp.amount
        ? parseFloat(exp.amount).toFixed(2)
        : '0.00',
      'Categoria': exp.category || '',
      'Data': exp.date
        ? exp.date.toDate().toLocaleDateString()
        : '',
    }));

    doc.autoTable({
      startY: finalY + 5,
      head: [['Descrizione', 'Importo (€)', 'Categoria', 'Data']],
      body: expensesData.map((row) => Object.values(row)),
    });

    doc.save(`report_contabilita_${dateRangeText}.pdf`);
  };

  const generateCSV = () => {
    // Filtra i dati
    const filteredReservations = filterReservations(reservations);
    const filteredExpenses = filterExpenses(expenses);

    // Prepara il testo del periodo del report
    let dateRangeText = '';
    if (reportType === 'year') {
      dateRangeText = `Anno ${selectedYear}`;
    } else if (reportType === 'month') {
      const monthName = new Date(
        selectedYear,
        selectedMonth - 1
      ).toLocaleString('default', { month: 'long' });
      dateRangeText = `${
        monthName.charAt(0).toUpperCase() + monthName.slice(1)
      } ${selectedYear}`;
    } else {
      dateRangeText = 'Tutte le Date';
    }

    // Prepara i dati delle entrate
    const revenueFields = [
      'Nome Ospite',
      'Numero Telefono',
      'Camera',
      'Prezzo (€)',
      'Extra (€)',
      'Stato Prenotazione',
      'Data Check-in',
      'Data Check-out',
    ];
    const revenue = filteredReservations.map((res) => {
      const extraAmount = getExtraAmount(res.extra);
      const price = res.price ? parseFloat(res.price) : 0;
      return {
        'Nome Ospite': res.guestName || '',
        'Numero Telefono': res.phoneNumber || '',
        'Camera': res.roomNumber || '',
        'Prezzo (€)': price.toFixed(2),
        'Extra (€)': extraAmount.toFixed(2),
        'Stato Prenotazione': RESERVATION_STATUS_LABELS[res.status] || 'In Attesa',
        'Data Check-in': res.checkInDate
          ? res.checkInDate.toDate().toLocaleDateString()
          : '',
        'Data Check-out': res.checkOutDate
          ? res.checkOutDate.toDate().toLocaleDateString()
          : '',
      };
    });

    // Prepara i dati delle spese
    const expensesFields = ['Descrizione', 'Importo (€)', 'Categoria', 'Data'];
    const expensesCSV = filteredExpenses.map((exp) => ({
      'Descrizione': exp.description || '',
      'Importo (€)': exp.amount
        ? parseFloat(exp.amount).toFixed(2)
        : '0.00',
      'Categoria': exp.category || '',
      'Data': exp.date
        ? exp.date.toDate().toLocaleDateString()
        : '',
    }));

    // Converte in CSV
    const csvRevenue = Papa.unparse(revenue, { columns: revenueFields });
    const csvExpenses = Papa.unparse(expensesCSV, { columns: expensesFields });

    // Combina il contenuto
    const csvContent = `Entrate\n${csvRevenue}\n\nSpese\n${csvExpenses}`;

    // Scarica il CSV
    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `report_contabilita_${dateRangeText}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="report-download">
      <h3>Genera Report</h3>
      
      <div className="report-filters">
        <label>
          Tipo di Report:
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
          >
            <option value="month">Mensile</option>
            <option value="year">Annuale</option>
          </select>
        </label>
  
        <label>
          Anno:
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
  
        {reportType === 'month' && (
          <label>
            Mese:
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
            >
              <option value={1}>Gennaio</option>
              <option value={2}>Febbraio</option>
              <option value={3}>Marzo</option>
              <option value={4}>Aprile</option>
              <option value={5}>Maggio</option>
              <option value={6}>Giugno</option>
              <option value={7}>Luglio</option>
              <option value={8}>Agosto</option>
              <option value={9}>Settembre</option>
              <option value={10}>Ottobre</option>
              <option value={11}>Novembre</option>
              <option value={12}>Dicembre</option>
            </select>
          </label>
        )}
      </div>
  
      <div className="report-buttons">
        <button onClick={generatePDF} className="btn pdf-btn">
          Scarica PDF
        </button>
        <button onClick={generateCSV} className="btn csv-btn">
          Scarica CSV
        </button>
      </div>
    </div>
  );
} 

export default ReportDownload;
