# 🎨 Hotel Dashboard - Unified Design System

## Overview
Sistema di design unificato per garantire coerenza visiva, user experience moderna e facilità di manutenzione su tutte le pagine dell'applicazione hotel dashboard.

---

## 📦 Componenti Principali

### 1. **Common Styles** (`src/styles/common.css`)
File CSS centralizzato che contiene tutte le classi riutilizzabili:

#### **Layout & Containers**
- `.page-container` - Container principale per le pagine
- `.page-header` - Intestazione pagina con titolo e sottotitolo
- `.page-title` - Titolo principale della pagina
- `.page-subtitle` - Descrizione/sottotitolo della pagina

#### **Cards & Panels**
- `.card` - Card principale con effetto hover
- `.card--interactive` - Card cliccabile
- `.panel` - Pannello informativo più semplice
- `.panel-header` - Intestazione del pannello

#### **Hero Sections**
- `.hero-section` - Sezione hero con gradient background
- `.hero-content` - Contenuto testuale dell'hero
- `.hero-eyebrow` - Soprattitolo dell'hero
- `.hero-title` - Titolo principale dell'hero
- `.hero-subtitle` - Sottotitolo dell'hero
- `.hero-actions` - Container per i pulsanti dell'hero

#### **Filters & Controls**
- `.filter-bar` - Barra dei filtri
- `.filter-group` - Gruppo di filtri correlati
- `.filter-buttons` - Container per i pulsanti filtro
- `.filter-btn` - Pulsante filtro individuale
- `.filter-btn.active` - Stato attivo del filtro

#### **Stats & Metrics**
- `.stats-grid` - Griglia di statistiche responsive
- `.stat-card` - Card per singola statistica
- `.stat-label` - Etichetta della statistica
- `.stat-value` - Valore numerico della statistica
- `.stat-trend` - Indicatore di tendenza

#### **Tables**
- `.table-wrapper` - Contenitore tabella con bordi e ombra
- `.data-table` - Tabella dati con layout fisso
- `.data-table thead` - Intestazione tabella
- `.data-table th` - Celle intestazione
- `.data-table td` - Celle dati
- `.data-table tbody tr:hover` - Effetto hover sulle righe

#### **Forms**
- `.form-container` - Container per form
- `.form-grid` - Griglia responsiva per campi form
- `.form-field` - Singolo campo form con label
- `.form-field-hint` - Testo di aiuto per i campi
- `.form-actions` - Container per pulsanti azioni form

#### **Action Buttons**
- `.actions-group` - Gruppo di pulsanti azioni
- `.btn-sm` - Pulsante small size
- `.btn-icon` - Pulsante solo icona circolare

#### **Status Indicators**
- `.status-badge` - Badge di stato con varianti colore
- `.status-badge--success` - Verde per successo
- `.status-badge--warning` - Arancione per avvisi
- `.status-badge--danger` - Rosso per pericolo
- `.status-badge--info` - Blu per informazioni
- `.status-dot` - Pallino indicatore di stato

#### **Messages & States**
- `.error-message` - Messaggio di errore con stile rosso
- `.success-message` - Messaggio di successo con stile verde
- `.empty-state` - Stato vuoto con icona e testo
- `.loading-spinner` - Spinner di caricamento animato
- `.skeleton` - Placeholder animato per contenuti in caricamento

#### **Modals & Drawers**
- `.modal-overlay` - Overlay per modali
- `.modal-content` - Contenuto modale
- `.modal-header` - Intestazione modale
- `.modal-title` - Titolo modale
- `.modal-close` - Pulsante chiusura modale
- `.modal-body` - Corpo del modale
- `.modal-footer` - Footer con azioni modale
- `.drawer-overlay` - Overlay per drawer laterali
- `.drawer-content` - Contenuto drawer
- `.drawer-header` - Intestazione drawer
- `.drawer-body` - Corpo drawer
- `.drawer-footer` - Footer drawer

---

### 2. **ReservationQuickView Component** (`src/components/ReservationQuickView.jsx`)

**Funzionalità:**
- Drawer laterale per visualizzare/modificare prenotazioni da qualsiasi pagina
- Apertura rapida tramite ID prenotazione
- Modalità visualizzazione e modifica
- Salvataggio in tempo reale
- Integrato con Firestore per aggiornamenti istantanei

**Utilizzo:**
```javascript
import ReservationQuickView from '../components/ReservationQuickView';

const [quickViewOpen, setQuickViewOpen] = useState(false);
const [selectedReservationId, setSelectedReservationId] = useState(null);

// Nel JSX
<ReservationQuickView
  reservationId={selectedReservationId}
  isOpen={quickViewOpen}
  onClose={() => setQuickViewOpen(false)}
  onUpdate={() => {
    // Callback dopo aggiornamento
  }}
/>
```

---

## 🎨 Design Tokens (CSS Variables)

Definiti in `src/styles/index.css`:

```css
--color-bg: #0f172a
--color-primary: #15294F
--color-primary-dark: #1d4ed8
--color-secondary: #38bdf8
--color-accent: #f59e0b
--color-success: #22c55e
--color-danger: #ef4444
--color-text: #0f172a
--color-text-soft: #475569
--radius-sm: 0.5rem
--radius-md: 0.9rem
--radius-lg: 1.25rem
--shadow-soft: 0 20px 45px -25px rgba(15, 23, 42, 0.55)
--shadow-card: 0 18px 40px -20px rgba(15, 23, 42, 0.45)
```

---

## 📄 Pagine Aggiornate

### ✅ Dashboard (`src/pages/Dashboard.jsx`)
- Hero section con gradient background
- Stats grid responsive
- Filter bar unificata
- Common error/success messages

### ✅ Expenses (`src/pages/Expenses.jsx`)
- Card-based layout
- Unified filter buttons
- Common table wrapper
- Actions group per pulsanti

### ✅ AddExpense (`src/pages/AddExpense.jsx`)
- Form container standardizzato
- Form grid responsive
- Form actions con pulsanti allineati

### ✅ ReservationsList (`src/pages/ReservationsList.jsx`)
- Integrazione ReservationQuickView
- Pulsante "Visualizza" per apertura quick view
- Accesso rapido alla modifica da tabella

---

## 🎯 Principi di Design

### 1. **Consistenza Visiva**
- Stesso padding, margin, border-radius su tutti i componenti
- Palette colori unificata
- Typography coerente (Inter + Montserrat)

### 2. **User Experience**
- Feedback visivo immediato (hover, focus, active states)
- Transizioni fluide e performanti
- Loading states e empty states ben definiti

### 3. **Accessibilità**
- Contrasti colori WCAG compliant
- Labels semantici
- ARIA attributes dove necessario
- Keyboard navigation

### 4. **Responsiveness**
- Mobile-first approach
- Breakpoints: 540px, 768px, 1024px, 1200px
- Grid e flexbox per layout adattivi
- Font sizes con clamp() per scaling fluido

### 5. **Performance**
- CSS ottimizzato e riutilizzabile
- Animazioni hardware-accelerated
- Lazy loading dove possibile

---

## 🚀 Quick Start per Nuove Pagine

### Template Base
```javascript
import React from 'react';
import Layout from '../components/Layout';

function NewPage() {
  return (
    <Layout>
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">Titolo Pagina</h1>
          <p className="page-subtitle">Descrizione della pagina</p>
        </div>

        <div className="card">
          {/* Contenuto della pagina */}
        </div>
      </div>
    </Layout>
  );
}

export default NewPage;
```

### Form Template
```javascript
<div className="card">
  <form className="form-container">
    <div className="form-grid">
      <div className="form-field">
        <label>Campo</label>
        <input type="text" />
      </div>
    </div>
    
    <div className="form-actions">
      <button className="btn btn--ghost">Annulla</button>
      <button className="btn btn--primary">Salva</button>
    </div>
  </form>
</div>
```

### Table Template
```javascript
<div className="table-wrapper">
  <table className="data-table">
    <thead>
      <tr>
        <th>Colonna 1</th>
        <th>Colonna 2</th>
        <th>Azioni</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Dato 1</td>
        <td>Dato 2</td>
        <td>
          <div className="actions-group">
            <button className="btn btn-sm btn--primary">Modifica</button>
            <button className="btn btn-sm">Elimina</button>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## 📱 Breakpoints Reference

```css
/* Mobile */
@media (max-width: 540px) { ... }

/* Tablet */
@media (max-width: 768px) { ... }

/* Tablet Large / Desktop Small */
@media (max-width: 1024px) { ... }

/* Desktop Medium */
@media (max-width: 1200px) { ... }
```

---

## 🔧 Manutenzione

### Aggiungere nuovi componenti comuni:
1. Definire stili in `src/styles/common.css`
2. Documentare in questo file
3. Usare naming BEM convention
4. Testare su tutti i breakpoints

### Modificare design tokens:
1. Aggiornare `src/styles/index.css`
2. Verificare impatto su tutte le pagine
3. Documentare il cambio

---

## ✨ Features Principali

- ✅ Design system unificato e centralizzato
- ✅ Componente QuickView per edit rapido prenotazioni
- ✅ Stili consistenti su tutte le pagine
- ✅ Responsive design completo
- ✅ Accessibilità migliorata
- ✅ Performance ottimizzate
- ✅ Manutenibilità semplificata
- ✅ UX moderna e user-friendly

---

## 📚 Prossimi Passi Suggeriti

1. Aggiornare le pagine rimanenti con common styles
2. Aggiungere dark mode support
3. Implementare i18n per multi-lingua
4. Creare componenti UI library documentata
5. Aggiungere unit tests per i componenti
6. Ottimizzare bundle size con tree-shaking

---

**Versione:** 2.0  
**Ultimo aggiornamento:** Ottobre 2025  
**Autore:** Design System Team
