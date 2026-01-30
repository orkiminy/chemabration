import React, { useState } from 'react';
import { auth, db } from './firebase'; 
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSignup = async () => {
    try {
      // 1. Create the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Create a "Profile" for them in the Database using their unique ID (uid)
      await setDoc(doc(db, "students", user.uid), {
        fullName: name,
        email: email,
        currentLevel: 0, // Start them at level 1
        createdAt: new Date()
      });

      alert("Account created successfully!");
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '300px', gap: '10px' }}>
      <h2>Student Signup</h2>
      <input type="text" placeholder="Full Name" onChange={(e) => setName(e.target.value)} />
      <input type="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
      <button onClick={handleSignup}>Sign Up</button>
    </div>
  );
};

export default Signup;