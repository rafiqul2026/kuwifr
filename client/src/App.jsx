import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <h1>Welcome to KUWIFR</h1>
        <p>Frontend is working!</p>
        
        <Routes>
          <Route path="/" element={<div>Home Page</div>} />
          <Route path="/about" element={<div>About Page</div>} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;