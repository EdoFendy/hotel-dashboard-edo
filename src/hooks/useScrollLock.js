// src/hooks/useScrollLock.js

import { useEffect } from 'react';

/**
 * Hook per bloccare lo scroll del body quando modal/drawer sono aperti
 * SOLUZIONE DEFINITIVA: Blocca lo scroll SENZA usare position fixed (che sposta la vista)
 */
export const useScrollLock = (isLocked) => {
  useEffect(() => {
    if (isLocked) {
      // Salva gli stili originali
      const originalOverflow = document.body.style.overflow;
      const originalPaddingRight = document.body.style.paddingRight;
      const originalTouchAction = document.body.style.touchAction;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      
      // Calcola scrollbar width per evitare layout shift
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      
      // BLOCCA LO SCROLL senza usare position fixed (che sposta la pagina)
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;
      document.body.style.touchAction = 'none'; // Blocca touch scroll su mobile
      document.documentElement.style.overflow = 'hidden';
      
      // Previeni scroll via keyboard (ma permetti nei drawer)
      const preventScroll = (e) => {
        // Permetti scroll dentro i drawer
        const target = e.target;
        const isInDrawer = target.closest('.drawer-overlay') || target.closest('.drawer-body');
        if (isInDrawer) return;
        
        // Blocca scroll con tastiera sulla pagina principale
        const keys = [32, 33, 34, 35, 36, 37, 38, 39, 40]; // space, page up/down, end, home, arrows
        if (keys.includes(e.keyCode)) {
          e.preventDefault();
        }
      };
      
      // Previeni scroll con mouse wheel sulla pagina (ma non sui drawer)
      const preventWheel = (e) => {
        const target = e.target;
        const isInDrawer = target.closest('.drawer-overlay') || target.closest('.drawer-body');
        if (isInDrawer) return;
        
        e.preventDefault();
      };
      
      window.addEventListener('keydown', preventScroll, { passive: false });
      window.addEventListener('wheel', preventWheel, { passive: false });
      
      return () => {
        // Ripristina tutti gli stili originali
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
        document.body.style.touchAction = originalTouchAction;
        document.documentElement.style.overflow = originalHtmlOverflow;
        
        // Rimuovi event listeners
        window.removeEventListener('keydown', preventScroll);
        window.removeEventListener('wheel', preventWheel);
        
        // NON serve scrollTo perché non abbiamo mai spostato la pagina
      };
    }
  }, [isLocked]);
};

export default useScrollLock;
