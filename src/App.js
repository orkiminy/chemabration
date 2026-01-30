
import Header from './Header';
import Footer from './Footer';
import OneStepReaction from './pages/OneStepReaction';
import Mechanism from './pages/Mechanism';
import Synthesis from './pages/Synthesis';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState } from "react";
import HomePage from './pages/HomePage';
import ChemicalCanvas from './ChemicalCanvas';



function App() {

  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/OneStepReaction" element={<OneStepReaction />} />
        <Route path="/Mechanism" element={<Mechanism />} />
        <Route path="/Synthesis" element={<Synthesis />} />
      </Routes>
    </Router>
  );
}

export default App;
