import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import firebase from 'firebase/compat/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { firebaseConfig } from './firebase-config';
import Auth from './Auth';
import MainPage from './MainPage';

firebase.initializeApp(firebaseConfig);
const auth = getAuth();

function App() {
    const [userEmail, setUserEmail] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserEmail(user.email);
                console.log('User is signed in:', user.email);
            } else {
                setUserEmail('');
                console.log('No user is signed in');
            }
            setLoading(false); // Set loading to false after checking auth state
        });

        return () => unsubscribe();
    }, []);

    // Render loading indicator while auth state is being checked
    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <div className="App">
            <Router>
                <Routes>
                    <Route path="/login" element={userEmail ? <Navigate to="/main" /> : <Auth />} />
                    <Route path="/main" element={userEmail ? <MainPage /> : <Navigate to="/login" />} />
                    <Route path="*" element={<Navigate to="/login" />} />
                </Routes>
            </Router>
        </div>
    );
}

export default App;