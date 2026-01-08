import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Import Styles
import './index.css';
import 'katex/dist/katex.min.css'; // Math rendering
import 'highlight.js/styles/github.css'; // Code highlighting (Light mode default)

// Note: For dark mode code highlighting, you might want to dynamically load styles 
// or use a neutral theme, but github.css is a good standard start.

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);