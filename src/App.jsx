// src/App.jsx

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ReservationsList from './pages/ReservationsList';
import AddReservationPage from './pages/AddReservationPage';
import EditReservation from './pages/EditReservation';
import DeleteReservation from './pages/DeleteReservation';
import CalendarPage from './pages/CalendarPage';
import Expenses from './pages/Expenses';
import AddExpense from './pages/AddExpense';
import EditExpense from './pages/EditExpense';
import Invoices from './pages/Invoices';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />

        <Route
          path="/reservations"
          element={
            <PrivateRoute>
              <ReservationsList />
            </PrivateRoute>
          }
        />

        <Route
          path="/reservations/new"
          element={
            <PrivateRoute>
              <AddReservationPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/reservations/edit/:id"
          element={
            <PrivateRoute>
              <EditReservation />
            </PrivateRoute>
          }
        />

        <Route
          path="/reservations/delete/:id"
          element={
            <PrivateRoute>
              <DeleteReservation />
            </PrivateRoute>
          }
        />

        <Route
          path="/calendar"
          element={
            <PrivateRoute>
              <CalendarPage />
            </PrivateRoute>
          }
        />

        {/* Nuove rotte per le spese */}
        <Route
          path="/expenses"
          element={
            <PrivateRoute>
              <Expenses />
            </PrivateRoute>
          }
        />

        <Route
          path="/expenses/add"
          element={
            <PrivateRoute>
              <AddExpense />
            </PrivateRoute>
          }
        />

        <Route
          path="/expenses/edit/:id"
          element={
            <PrivateRoute>
              <EditExpense />
            </PrivateRoute>
          }
        />

        {/* Rotta per le fatture */}
        <Route
          path="/invoices"
          element={
            <PrivateRoute>
              <Invoices />
            </PrivateRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;
