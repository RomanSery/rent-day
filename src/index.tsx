import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/public-sans/400.css';
import '@fontsource/public-sans/500.css';
import '@fontsource/public-sans/600.css';
import '@fontsource/public-sans/700.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './client/css/index.css';
import './client/css/board.css';
import './client/css/center.css';
import './client/css/pieces.css';
import './client/css/die.css';
import './client/css/mobile.css';
import App from './client/App';
import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import { ThemeProvider } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';
import { cssVariables, theme } from './client/theme';

const container = document.getElementById('root');
if (!container) {
  throw new Error("root element not found");
}

createRoot(container).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles styles={{ ':root': cssVariables }} />
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
