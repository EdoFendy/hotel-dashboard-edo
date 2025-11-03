// src/utils/pdfSetup.js
// File dedicato per setup jsPDF e plugin

import { jsPDF } from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';

// Applica il plugin a jsPDF per abilitare il metodo .autoTable()
applyPlugin(jsPDF);

// Export jsPDF già configurato con il plugin
export { jsPDF };
