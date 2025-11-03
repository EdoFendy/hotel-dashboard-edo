# 📄 Sistema Report Giornaliero Camere

## 🎯 Scopo

Sistema dedicato al **personale pulizie e gestione** per stampare un report giornaliero dello stato delle camere con informazioni operative.

---

## 📋 Contenuto del Report PDF

### **1. Intestazione**
- Logo hotel
- Titolo: "REPORT STATO CAMERE"
- Data completa (es: "Lunedì, 3 novembre 2024")

### **2. Riepilogo Numerico**
- 📊 Camere Occupate
- 🚪 In Partenza (checkout oggi)
- ✨ Arrivi Oggi (check-in oggi)
- ✓ Disponibili

### **3. Sezione CAMERE FERMATA** (Ospiti che restano)
📄 **Sfondo giallo** - Per ogni camera:
- Numero camera + tipo (es: "Camera 5 - Singola")
- Nome ospite
- Data check-out
- Numero persone
- 📝 Note aggiuntive (se presenti)
- **Spazio per note pulizie** (da compilare a mano)

### **4. Sezione IN PARTENZA** (Checkout oggi)
📄 **Sfondo rosso** - Per ogni camera:
- Numero camera + tipo
- Nome ospite
- Numero persone
- **Servizi Extra utilizzati:**
  - 🐕 Pet
  - 🍹 Bar
  - 🔧 Servizi
  - 👶 Culla
- 📝 Note aggiuntive
- **Spazio per note pulizie/servizi** (da compilare a mano)

### **5. Sezione NUOVI ARRIVI** (Check-in oggi)
📄 **Sfondo verde** - Info essenziali:
- Numero camera + tipo
- Nome ospite
- Numero persone

### **6. Camere Disponibili**
📄 **Sfondo verde chiaro** - Lista numeri camere libere

---

## 🔧 Implementazione Tecnica

### **File Creati**

1. **`src/utils/dailyRoomStatusPDF.js`**
   - Utility per generare PDF
   - Usa jsPDF + autoTable
   - Formattazione professionale
   - Multi-pagina automatico

2. **`src/components/DailyRoomStatusButton.jsx`**
   - Bottone con logica query Firestore
   - Categorizza camere automaticamente
   - Genera e scarica PDF

### **File Modificati**

- **`src/pages/Dashboard.jsx`**
  - Aggiunto import `DailyRoomStatusButton`
  - Bottone verde nella hero-actions

---

## 📊 Logica Categorizzazione Camere

```javascript
OGGI = Data corrente (ore 00:00:00)

Per ogni prenotazione:
  checkIn = data check-in
  checkOut = data check-out
  
  Se (checkIn < OGGI && checkOut == OGGI):
    → IN PARTENZA (checkout oggi)
    
  Se (checkIn == OGGI):
    → NUOVI ARRIVI (check-in oggi)
    
  Se (checkIn < OGGI && checkOut > OGGI):
    → FERMATA (ospiti che restano)
    
  Se (camera non in nessuna prenotazione):
    → DISPONIBILE
```

---

## 🎨 Design PDF

### **Colori**
- 🟨 **Giallo** (`#FFF3CD`) - Camere Fermata
- 🟥 **Rosso** (`#FFDCDC`) - In Partenza
- 🟩 **Verde** (`#DCFFDC`) - Nuovi Arrivi
- ⬜ **Bianco** - Disponibili

### **Layout**
- Font: Helvetica
- Dimensioni: A4 (210x297mm)
- Margini: 10mm
- Spaziatura tra sezioni: 6mm
- Box note: 10-12mm altezza

### **Elementi Stampabili**
- ✅ Spazi bianchi per note a mano
- ✅ Linee guida grigio chiaro
- ✅ Testo "Note pulizie:" in grigio
- ✅ Footer con data/ora generazione

---

## 🚀 Come Usare

### **Dalla Dashboard:**

1. **Apri Dashboard** (`/`)
2. **Click bottone verde** "📄 Report Camere Oggi"
3. **Attendi generazione** (1-2 secondi)
4. **PDF scaricato automaticamente** nel browser
5. **Nome file**: `Report_Camere_03-11-2024.pdf`

### **Workflow Consigliato:**

```
Ogni mattina:
1. Manager apre Dashboard
2. Genera report del giorno
3. Stampa PDF
4. Consegna al personale pulizie
5. Personale compila note a mano durante il giorno
6. Report conservato come registro
```

---

## 📱 Responsive

Il bottone nella Dashboard è:
- ✅ Responsive su mobile (full-width)
- ✅ Loading state visivo
- ✅ Hover effect (desktop)
- ✅ Disabilitato durante generazione

---

## 🔍 Query Firestore Ottimizzata

```javascript
// Carica TUTTE le prenotazioni una sola volta
const snapshot = await getDocs(collection(db, 'reservations'));

// Filtra client-side per categorizzazione
// Più efficiente di multiple query con where()
snapshot.docs.forEach(doc => {
  // Logica categorizzazione...
});
```

**Perché non usare query where():**
- Necessario filtrare per OGGI
- Timestamp comparison complessa
- Più veloce caricare tutto e filtrare
- Poche prenotazioni (~100-500 max)

---

## 📄 Esempio Output PDF

```
╔════════════════════════════════════════╗
║  REPORT STATO CAMERE                   ║
║  Lunedì, 3 novembre 2024              ║
╠════════════════════════════════════════╣
║ 📊 RIEPILOGO                           ║
║ Occupate: 8 | In Partenza: 2          ║
║ Arrivi: 3 | Disponibili: 6            ║
╠════════════════════════════════════════╣
║ 🏨 CAMERE FERMATA                      ║
║ ─────────────────────────────────────  ║
║ Camera 5 - Singola                     ║
║ Ospite: Mario Rossi                    ║
║ Check-out: 05/11/2024                  ║
║ Persone: 1                             ║
║ Note: Richiesta pulizia extra         ║
║ [Spazio note pulizie: ____________]    ║
╠════════════════════════════════════════╣
║ 🚪 IN PARTENZA                         ║
║ ─────────────────────────────────────  ║
║ Camera 12 - Matrimoniale               ║
║ Ospite: Lucia Bianchi                  ║
║ Persone: 2                             ║
║ Servizi Extra:                         ║
║   • 🐕 Pet                             ║
║   • 🍹 Bar: €25                        ║
║ [Spazio note servizi: ____________]    ║
╚════════════════════════════════════════╝
```

---

## ✅ Vantaggi

### **Per il Personale:**
- ✅ Report chiaro e organizzato
- ✅ Info essenziali a colpo d'occhio
- ✅ Spazio per note operative
- ✅ Stampabile e portatile
- ✅ Nessun login/password necessario

### **Per il Management:**
- ✅ Generazione automatica (1 click)
- ✅ Dati sempre aggiornati dal database
- ✅ Storico stampabile
- ✅ Professionale per controlli

### **Per l'Hotel:**
- ✅ Organizzazione migliorata
- ✅ Comunicazione efficace
- ✅ Tracking servizi extra
- ✅ Documentazione giornaliera

---

## 🔮 Possibili Miglioramenti Futuri

1. **Filtro Data Personalizzata** - Report per altre date
2. **Invio Email** - Invia PDF via email automaticamente
3. **QR Code** - Per scansione rapida dati camera
4. **Check-list Pulizie** - Template standard da stampare
5. **Foto Camere** - Include foto stato post-pulizia
6. **Multi-lingua** - EN/IT/FR
7. **Export Excel** - Alternativa formato dati

---

## 🎯 Testing

**Scenari da testare:**
- ✅ Nessuna prenotazione (tutte disponibili)
- ✅ Solo checkout oggi
- ✅ Solo check-in oggi
- ✅ Mix di fermata + partenza + arrivi
- ✅ Camere gruppo (più camere stessa prenotazione)
- ✅ Note lunghe (troncamento corretto)
- ✅ Molte camere (multi-pagina automatico)

---

**Sistema Completato e Pronto all'Uso! 🎉**

Genera report professionali per il personale in 1 click dalla Dashboard.
