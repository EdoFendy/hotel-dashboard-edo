# Istruzioni per Riparare CalendarPage.jsx

Il file CalendarPage.jsx si è corrotto durante l'editing automatico con codice duplicato.

## Problema
- Funzioni duplicate (handleCheckOut, confirmCheckOut, etc.)
- Codice JSX malformato
- 909 righe invece delle ~660 originali

## Soluzione Rapida

### Opzione 1: Ripristino Manuale
1. Apri `src/pages/CalendarPage.jsx`
2. Cerca e **rimuovi tutte le righe duplicate** tra le righe 280-360 circa
3. Assicurati che ci sia una sola definizione di:
   - `handleCheckOut`
   - `confirmCheckOut`
   - `handleEmptyCellClick`
   - `generateDays`
   - `normalizeDate`
   - `toggleBookingMode`

### Opzione 2: Modifiche Specifiche da Applicare

Nel file CalendarPage.jsx **ORIGINALE** (prima della corruzione), aggiungi:

#### 1. Import (riga ~6)
```javascript
import { Timestamp } from 'firebase/firestore';
import { it } from 'date-fns/locale';
import ReservationQuickView from '../components/ReservationQuickView';
import '../styles/common.css';
```

#### 2. Stati (dopo riga ~76)
```javascript
const [checkoutReservation, setCheckoutReservation] = useState(null);
const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
const [quickViewOpen, setQuickViewOpen] = useState(false);
const [selectedReservationId, setSelectedReservationId] = useState(null);
```

#### 3. Funzioni Checkout (dopo handleReservationClick, riga ~218)
```javascript
// Gestisce il checkout
const handleCheckOut = (reservation) => {
  setCheckoutReservation(reservation);
  setCheckoutModalOpen(true);
  setSelectedReservation(null);
};

// Conferma checkout
const confirmCheckOut = async () => {
  if (!checkoutReservation) return;
  try {
    const reservationRef = doc(db, 'reservations', checkoutReservation.id);
    await updateDoc(reservationRef, {
      status: 'conclusa',
      paymentCompleted: true,
      checkOutDate: Timestamp.fromDate(new Date()),
    });
    setCheckoutModalOpen(false);
    setCheckoutReservation(null);
    alert('Check-out completato con successo!');
  } catch (error) {
    console.error('Errore durante il check-out:', error);
    alert('Errore durante il check-out. Riprova.');
  }
};
```

#### 4. Sostituisci il pulsante "Modifica Prenotazione" nel modale (riga ~627)
TROVA:
```javascript
<button
  className={`${styles.btn} ${styles.editBtn}`}
  onClick={() => {
    setReservationToEdit(selectedReservation);
    setIsEditModalOpen(true);
  }}
>
  Modifica Prenotazione
</button>
```

SOSTITUISCI CON:
```javascript
<div className={styles.modalActions}>
  <button
    className="btn btn-sm btn--primary"
    onClick={() => {
      setSelectedReservationId(selectedReservation.id);
      setQuickViewOpen(true);
      setSelectedReservation(null);
    }}
  >
    👁️ Visualizza/Modifica
  </button>
  
  {selectedReservation.status !== 'conclusa' && (
    <button
      className="btn btn-sm"
      onClick={() => handleCheckOut(selectedReservation)}
      style={{ background: 'var(--color-success)', color: 'white' }}
    >
      ✓ Check Out
    </button>
  )}
</div>
```

#### 5. Aggiungi Modal Checkout (prima della chiusura </Layout>, riga ~655)
```javascript
{/* Checkout Modal */}
{checkoutModalOpen && checkoutReservation && (
  <div className="modal-overlay">
    <div className="modal-content" style={{ maxWidth: '500px' }}>
      <div className="modal-header">
        <h3 className="modal-title">Conferma Check-Out</h3>
        <button 
          className="modal-close" 
          onClick={() => {
            setCheckoutModalOpen(false);
            setCheckoutReservation(null);
          }}
        >
          ✕
        </button>
      </div>
      
      <div className="modal-body">
        <p style={{ marginBottom: '1rem' }}>
          <strong>Ospite:</strong> {checkoutReservation.guestName}
        </p>
        <p style={{ marginBottom: '1rem' }}>
          <strong>Stanza:</strong> {Array.isArray(checkoutReservation.roomNumbers) 
            ? checkoutReservation.roomNumbers.join(', ') 
            : checkoutReservation.roomNumber}
        </p>
        <p style={{ marginBottom: '1.5rem', color: 'rgba(15, 23, 42, 0.65)' }}>
          Confermi di voler effettuare il check-out per questa prenotazione?
        </p>
      </div>
      
      <div className="modal-footer">
        <button 
          className="btn btn--ghost"
          onClick={() => {
            setCheckoutModalOpen(false);
            setCheckoutReservation(null);
          }}
        >
          Annulla
        </button>
        <button 
          className="btn btn--primary"
          onClick={confirmCheckOut}
        >
          Conferma Check-Out
        </button>
      </div>
    </div>
  </div>
)}

{/* Quick View Drawer */}
<ReservationQuickView
  reservationId={selectedReservationId}
  isOpen={quickViewOpen}
  onClose={() => {
    setQuickViewOpen(false);
    setSelectedReservationId(null);
  }}
  onUpdate={() => {
    // Auto-update via onSnapshot
  }}
/>
```

#### 6. Modernizza Header (riga ~388-391)
TROVA:
```javascript
<div className={styles.calendarPageContainer}>
  <div className={styles.calendarPage}>
    <h2 className={styles.calendarTitle}>Calendario Prenotazioni (Vista Lista)</h2>
```

SOSTITUISCI CON:
```javascript
<div className="page-container">
  <div className="page-header">
    <h1 className="page-title">Calendario Prenotazioni</h1>
    <p className="page-subtitle">
      Visualizza le occupazioni delle camere e gestisci check-in/check-out con un click.
    </p>
  </div>
  <div className="card">
```

E chiudi con `</div>` prima di `</div>` finale (prima del QuickView).

## Test
Dopo le modifiche:
1. Vai al calendario
2. Clicca su una prenotazione
3. Verifica che appaia il pulsante "✓ Check Out"
4. Clicca e conferma il checkout
5. Verifica che lo stato cambi in "conclusa"

## Note
- Il file corrotto ha 909 righe
- Il file corretto dovrebbe avere ~700 righe
- Se hai problemi, ricomincia da una versione pulita del file
