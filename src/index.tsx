import React from 'react';
import ReactDOM from 'react-dom';
import './client/css/index.css';
import './client/css/board.css';
import './client/css/center.css';
import './client/css/pieces.css';
import App from './client/App';
import { CssBaseline } from '@material-ui/core';
import { BrowserRouter } from 'react-router-dom';

ReactDOM.render(
  <React.StrictMode>
    <BrowserRouter>
      <CssBaseline />
      <App />
    </BrowserRouter>

  </React.StrictMode>,
  document.getElementById('root')
);

