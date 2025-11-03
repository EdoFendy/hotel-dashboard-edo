# 🔧 Fix: jsPDF autoTable Error

## Problema

Errore: `docPdf.autoTable is not a function`

Questo errore si verificava quando si tentava di generare PDF delle fatture.

## Causa Reale

Con `jspdf-autotable` v5.x e `jspdf` v3.x, il plugin NON si applica automaticamente con un semplice `import 'jspdf-autotable'`.

Bisogna **esplicitamente applicare il plugin** usando la funzione `applyPlugin()` fornita dalla libreria.

## Soluzione

Creato un file di setup dedicato che garantisce il corretto caricamento del plugin con Vite:

### File Creato

**`src/utils/pdfSetup.js`** (NUOVO)
```javascript
import { jsPDF } from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';

// Applica il plugin a jsPDF per abilitare .autoTable()
applyPlugin(jsPDF);

// Export jsPDF già configurato
export { jsPDF };
```

### File Modificato

**`src/utils/invoiceGenerator.js`**
```javascript
import { jsPDF } from './pdfSetup'; // Import jsPDF già configurato
import logo from '../assets/logo.png';
```

**Importante:** Con `jspdf-autotable` v5.x, è **OBBLIGATORIO** chiamare `applyPlugin(jsPDF)` per registrare il metodo `.autoTable()`. Un semplice import side-effect NON funziona.

## Come Funziona

1. Importiamo `{ jsPDF }` from 'jspdf'
2. Importiamo `{ applyPlugin }` from 'jspdf-autotable'
3. Chiamiamo `applyPlugin(jsPDF)` per registrare il metodo
4. Ora tutte le istanze di `jsPDF` hanno il metodo `.autoTable()` disponibile
5. `docPdf.autoTable({...})` funziona correttamente

## Nota Importante

⚠️ **L'import deve essere fatto in OGNI file che usa `downloadInvoicePDF()` o `generateInvoicePDF()`**

Anche se la funzione è in un file separato (`invoiceGenerator.js`), l'import del plugin deve essere fatto nel file che **chiama** la funzione, non solo nel file che la definisce.

## Verificato Funzionante

✅ Download PDF da pagina Fatture  
✅ Generazione PDF al checkout (ReservationsList)  
✅ Generazione PDF da cambio stato "Conclusa" (ReservationQuickView)  

## Se il Problema Persiste

1. Verifica che `jspdf-autotable` sia installato:
   ```bash
   npm list jspdf-autotable
   ```

2. Se non installato:
   ```bash
   npm install jspdf-autotable
   ```

3. Riavvia il dev server:
   ```bash
   npm run dev
   ```
