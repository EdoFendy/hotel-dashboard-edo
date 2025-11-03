// src/pages/AddReservationPage.jsx

import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import AddReservationDrawer from '../components/AddReservationDrawer';

function AddReservationPage() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    navigate('/reservations');
  }, [navigate]);

  const handleSuccess = useCallback(() => {
    setIsOpen(false);
    navigate('/reservations');
  }, [navigate]);

  return (
    <Layout>
      <AddReservationDrawer
        isOpen={isOpen}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    </Layout>
  );
}

export default AddReservationPage;
