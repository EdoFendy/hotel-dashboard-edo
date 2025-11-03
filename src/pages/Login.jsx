// src/pages/Login.jsx

import React, { useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../styles/Login.css';

/**
 * Componente per la pagina di login
 */
function Login() {
  const emailRef = useRef();
  const passwordRef = useRef();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const navigate = useNavigate();

  /**
   * Gestisce la sottomissione del modulo di login
   * @param {object} e
   */
  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setError('');
      await login(emailRef.current.value, passwordRef.current.value);
      navigate('/');
    } catch (error) {
      console.error('Errore durante il login:', error);
      switch (error.code) {
        case 'auth/user-not-found':
          setError('Utente non trovato');
          break;
        case 'auth/wrong-password':
          setError('Password errata');
          break;
        case 'auth/invalid-email':
          setError('Email non valida');
          break;
        default:
          setError('Errore durante l\'accesso');
      }
    }
  }

  return (
    <div className="login-container">
      <h2>Login Admin</h2>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <label>Email:</label>
        <input type="email" ref={emailRef} required />
        <label>Password:</label>
        <input type="password" ref={passwordRef} required />
        <button type="submit">Accedi</button>
      </form>
    </div>
  );
}

export default Login;
