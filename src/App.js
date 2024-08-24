import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import firebase from 'firebase/compat/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { firebaseConfig } from './firebaseConfig';
import Auth from './Auth';
import MainPage from './MainPage';

firebase.initializeApp(firebaseConfig);
const auth = getAuth();

function App() {
    const [userId, setUserId] = useState(null); // State to store userId
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserId(user.uid); // Set userId if user is authenticated
                console.log('User is signed in:', user.email);
            } else {
                setUserId(null); // Set userId to null if no user is authenticated
                console.log('No user is signed in');
            }
            setLoading(false); // Set loading to false after checking auth state
        });

        return () => unsubscribe();
    }, []);

    // Render loading indicator while auth state is being checked
    if (loading) {
        return (
            <div style={{
                display: 'flex', justifyContent: 'center',
                alignItems: 'center', height: '100vh',
                fontSize: '2.4em', fontWeight: 'bold',
                fontStyle: 'italic', color: 'gray'
            }}> Loading... </div>
        );
    }

    return (
        <div className="App">
            <Router>
                <Routes>
                    <Route path="/login" element={userId ? <Navigate to="/main" /> : <Auth />} />
                    {/* Pass userId to MainPage component */}
                    <Route path="/main" element={userId ? <MainPage userId={userId} /> : <Navigate to="/login" />} />
                    <Route path="*" element={<Navigate to="/login" />} />
                </Routes>
            </Router>
        </div>
    );
}

export default App;