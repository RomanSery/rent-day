import React from 'react';
import { createRoot } from 'react-dom/client';
import './client/css/index.css';
import './client/css/board.css';
import './client/css/center.css';
import './client/css/pieces.css';
import './client/css/die.css';
import './client/css/mobile.css';
import App from './client/App';
import CssBaseline from '@mui/material/CssBaseline';
import { BrowserRouter } from 'react-router-dom';

const container = document.getElementById('root');
if (!container) {
  throw new Error("root element not found");
}

createRoot(container).render(
  <React.StrictMode>
    <BrowserRouter>
      <CssBaseline />
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
