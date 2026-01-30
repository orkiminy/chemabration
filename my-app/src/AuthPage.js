import React, { useState } from 'react';
import { auth, db } from './firebase'; 
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

export default function AuthPage({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true); // Toggle between Login and Signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        // Log In
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // Sign Up
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        // Create the student profile
        await setDoc(doc(db, "students", user.uid), {
          fullName: name,
          email: email,
          questionCount: 1,
        });
      }
      onLoginSuccess(); // Tell the app to move to the game
    } catch (error) {
      alert(error.message);
    }
  };

  const containerStyle = {
    backgroundColor: "#f9e1e8", // Light pink from your screenshot
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    fontFamily: "Arial, sans-serif"
  };

  const headerStyle = {
    backgroundColor: "#5f021f", // Maroon from your screenshot
    color: "white",
    width: "100%",
    textAlign: "center",
    padding: "20px 0",
    fontSize: "24px",
    fontWeight: "bold",
    letterSpacing: "2px"
  };

  const formStyle = {
    backgroundColor: "white",
    padding: "40px",
    borderRadius: "15px",
    boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
    marginTop: "50px",
    width: "350px",
    display: "flex",
    flexDirection: "column",
    gap: "15px"
  };

  const buttonStyle = {
    backgroundColor: "#5f021f",
    color: "white",
    border: "none",
    padding: "12px",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "bold"
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>CHEMEBRATION</div>
      
      <form style={formStyle} onSubmit={handleSubmit}>
        <h2 style={{ color: "#5f021f", textAlign: "center", margin: 0 }}>
          {isLogin ? "Welcome Back" : "Join the Celebration"}
        </h2>
        
        {!isLogin && (
          <input 
            type="text" placeholder="Full Name" required 
            style={{ padding: "10px" }} onChange={(e) => setName(e.target.value)} 
          />
        )}
        
        <input 
          type="email" placeholder="Email Address" required 
          style={{ padding: "10px" }} onChange={(e) => setEmail(e.target.value)} 
        />
        
        <input 
          type="password" placeholder="Password" required 
          style={{ padding: "10px" }} onChange={(e) => setPassword(e.target.value)} 
        />
        
        <button type="submit" style={buttonStyle}>
          {isLogin ? "Log In" : "Create Account"}
        </button>

        <p 
          style={{ textAlign: "center", color: "#666", fontSize: "14px", cursor: "pointer" }}
          onClick={() => setIsLogin(!isLogin)}
        >
          {isLogin ? "New here? Create an account" : "Already have an account? Log in"}
        </p>
      </form>
    </div>
  );
}