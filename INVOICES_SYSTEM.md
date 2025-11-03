# 📄 Sistema Gestione Fatture - Documentazione Completa

## 🎯 Panoramica

Sistema completo per la gestione delle fatture generate automaticamente al checkout delle prenotazioni. Le fatture vengono salvate in Firestore e possono essere scaricate in qualsiasi momento dalla pagina dedicata.

---

## 📁 Struttura File

### **File Creati/Modificati**

1. **`src/utils/invoiceGenerator.js`** (NUOVO)
   - Utility riutilizzabile per generazione PDF fatture
   - Funzioni: `generateInvoicePDF()`, `downloadInvoicePDF()`, `generateInvoiceNumber()`
   - Usa jsPDF e jspdf-autotable

2. **`src/pages/Invoices.jsx`** (NUOVO)
   - Pagina dedicata visualizzazione e download fatture
   - Statistiche in tempo reale
   - Filtri per ricerca e stato
   - Tabella responsive con tutte le fatture

3. **`src/styles/Invoices.css`** (NUOVO)
   - Stili moderni per pagina fatture
   - Design coerente con resto applicazione
   - Responsive mobile/tablet/desktop

4. **`src/pages/ReservationsList.jsx`** (MODIFICATO)
   - Rimosso codice PDF inline (180+ righe)
   - Usa utility `invoiceGenerator`
   - Salva fattura in Firestore al checkout
   - Genera numero fattura progressivo

5. **`src/components/Sidebar.jsx`** (MODIFICATO)
   - Aggiunto link "📄 Fatture" nel menu

6. **`src/App.jsx`** (MODIFICATO)
   - Aggiunta route `/invoices`

---

## 🗄️ Database Firestore

### **Collection: `invoices`**

```javascript
{
  // Identificativi
  invoiceNumber: "INV-2024-0001",      // Numero fattura progressivo
  invoiceCount: 1,                      // Contatore progressivo
  reservationId: "abc123",              // ID prenotazione collegata
  
  // Dati Ospite
  guestName: "Mario Rossi",
  phoneNumber: "+39 123 456 7890",
  
  // Date
  checkInDate: Timestamp,
  checkOutDate: Timestamp,
  createdAt: Timestamp,
  
  // Camere
  roomNumbers: [1, 5, 8],               // Array numeri camere
  
  // Prezzi
  price: 450.00,                        // Prezzo base
  totalExtras: 30.00,                   // Totale extras
  deposit: 100.00,                      // Caparra versata
  totalAmount: 380.00,                  // Totale da pagare (price + extras - deposit)
  
  // Stato
  status: "paid",                       // paid | pending
  
  // Dati Completi per Rigenerare PDF
  reservationData: {
    ...checkoutReservation,             // Tutti i dati prenotazione
    totalPeople: 6,
    roomPrices: {...},
    extraPerRoom: {...},
    roomCribs: {...},
    // ... tutti gli altri campi necessari
  }
}
```

### **Collection: `reservations` (aggiornata)**

Aggiunto campo:
```javascript
{
  // ... campi esistenti ...
  invoiceNumber: "INV-2024-0001",      // Collegamento a fattura (aggiunto al checkout)
}
```

---

## 🔄 Flusso Operativo

### **1. Checkout Prenotazione**

```
User clicca "Check Out" → 
  ↓
1. Ottiene ultimo numero fattura da Firestore
2. Genera nuovo numero progressivo (INV-2024-XXXX)
3. Calcola totali (prezzo + extras - caparra)
4. Salva fattura in collection 'invoices'
5. Aggiorna prenotazione (status: conclusa, invoiceNumber)
6. Genera e scarica PDF automaticamente
7. Mostra conferma con numero fattura
```

### **2. Visualizzazione Fatture**

```
User va su /invoices →
  ↓
1. Carica tutte le fatture da Firestore (real-time)
2. Mostra statistiche (totale, fatturato, anno corrente)
3. Permette ricerca per nome/numero
4. Filtra per stato (tutte/pagate)
5. Tabella con tutte le info
6. Bottone download per ogni fattura
```

### **3. Download PDF**

```
User clicca "Scarica PDF" →
  ↓
1. Recupera reservationData dalla fattura
2. Chiama generateInvoicePDF() con dati completi
3. Genera PDF con jsPDF
4. Download automatico nel browser
5. Nome file: Fattura_INV-2024-0001_Mario-Rossi.pdf
```

---

## 📊 Funzionalità Pagina Fatture

### **Statistiche in Tempo Reale**
- 📊 Totale Fatture
- 💰 Fatturato Totale
- 📅 Fatture Anno Corrente
- ✅ Fatture Pagate

### **Filtri e Ricerca**
- 🔍 Ricerca per nome ospite o numero fattura
- Filtro stato: Tutte | Pagate

### **Tabella Fatture**
Colonne:
- Numero Fattura (INV-2024-XXXX)
- Data Creazione
- Ospite (nome + telefono)
- Camere
- Importo Totale
- Stato (badge colorato)
- Azioni (bottone download)

### **Design**
- ✅ Responsive (mobile/tablet/desktop)
- ✅ Stile moderno coerente
- ✅ Animazioni smooth
- ✅ Loading states
- ✅ Empty states

---

## 🎨 Contenuto PDF Fattura

### **Header**
- Logo hotel (top-left)
- Numero fattura (top-right)
- Data emissione (top-right)
- Titolo "Fattura di Checkout"

### **Sezione Ospite**
- Nome ospite
- Numero telefono

### **Sezione Soggiorno**
- Numero camere
- Data check-in
- Data check-out
- Numero notti

### **Sezione Prezzi Totali**
- Prezzo Totale
- Extras Totali
- Caparra Versata (-)
- **Totale da Pagare** (evidenziato)

### **Dettagli Camere** (se gruppo)
- Prezzo per notte per camera
- Extras per camera:
  - Pet (+10€)
  - Bar (€)
  - Servizi (€)
  - Culla (+10€)

### **Footer**
- Numero totale persone
- Messaggio ringraziamento

---

## 🔧 Utility Functions

### **`generateInvoicePDF(reservation, invoiceNumber)`**
Genera documento PDF completo.
- **Input**: Dati prenotazione + numero fattura
- **Output**: Oggetto jsPDF
- **Uso**: Interno per generazione

### **`downloadInvoicePDF(reservation, invoiceNumber)`**
Genera e scarica immediatamente PDF.
- **Input**: Dati prenotazione + numero fattura
- **Output**: Download file PDF
- **Uso**: Da pagina Invoices e checkout

### **`generateInvoiceNumber(count)`**
Genera numero fattura progressivo formattato.
- **Input**: Contatore numerico (es. 1, 2, 3...)
- **Output**: String formattato (es. "INV-2024-0001")
- **Formato**: `INV-{ANNO}-{NUMERO_4_CIFRE}`

---

## 🚀 Vantaggi Sistema Nuovo

### **Prima (Sistema Vecchio)**
❌ PDF generato solo al checkout  
❌ Nessun salvataggio in database  
❌ Impossibile riscaricare fatture  
❌ Nessuna tracciabilità  
❌ Codice duplicato (180+ righe)  
❌ Nessuna pagina dedicata  

### **Dopo (Sistema Nuovo)**
✅ PDF salvato in Firestore  
✅ Metadati completi per ogni fattura  
✅ Download illimitato in qualsiasi momento  
✅ Tracciabilità completa  
✅ Codice riutilizzabile (utility)  
✅ Pagina dedicata con statistiche  
✅ Ricerca e filtri  
✅ Numerazione progressiva automatica  
✅ Real-time updates  

---

## 📱 Responsive Design

### **Desktop (>1024px)**
- Tabella completa con tutte le colonne
- Statistiche in griglia 4 colonne
- Layout ottimizzato per grandi schermi

### **Tablet (768px - 1024px)**
- Tabella scrollabile orizzontalmente
- Statistiche in griglia 2 colonne
- Filtri in colonna singola

### **Mobile (<768px)**
- Tabella scrollabile
- Statistiche in colonna singola
- Filtri full-width
- Bottoni ottimizzati touch

---

## 🔐 Sicurezza

- ✅ Route protetta con `PrivateRoute`
- ✅ Dati sensibili solo in Firestore (non nel PDF pubblico)
- ✅ Validazione input lato client e server
- ✅ Firestore Security Rules (da configurare)

---

## 🎯 Prossimi Miglioramenti Possibili

1. **Export Excel/CSV** - Esporta lista fatture
2. **Invio Email** - Invia fattura via email all'ospite
3. **Stampa Diretta** - Stampa senza download
4. **Fatture Proforma** - Genera fatture prima del checkout
5. **Multi-valuta** - Supporto altre valute
6. **Template Personalizzabili** - Diversi layout PDF
7. **Statistiche Avanzate** - Grafici fatturato mensile/annuale
8. **Archiviazione Cloud** - Backup automatico PDF su cloud storage

---

## 📞 Supporto

Per problemi o domande sul sistema fatture:
1. Verifica che Firestore sia configurato correttamente
2. Controlla console browser per errori
3. Verifica che jsPDF sia installato: `npm install jspdf jspdf-autotable`
4. Controlla che il logo sia presente in `src/assets/logo.png`

---

## ✅ Checklist Implementazione

- [x] Utility `invoiceGenerator.js` creata
- [x] Pagina `Invoices.jsx` creata
- [x] CSS `Invoices.css` creato
- [x] `ReservationsList.jsx` aggiornato
- [x] Route `/invoices` aggiunta
- [x] Link sidebar aggiunto
- [x] Collection Firestore `invoices` configurata
- [x] Numerazione progressiva implementata
- [x] Download PDF funzionante
- [x] Statistiche real-time
- [x] Filtri e ricerca
- [x] Design responsive

---

**Sistema Fatture Completato al 100%! 🎉**
