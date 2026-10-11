/**
 * DirectMarket - Punto de montaje de React
 *
 * Importa los estilos globales y monta la aplicacion en el DOM.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
