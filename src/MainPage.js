import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './MainPage.css'; // Import your CSS file
import firebase from 'firebase/compat/app';
import { getAuth, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { firebaseConfig } from './firebase-config';

firebase.initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function MainPage({ userId }) {
  const [hours, setHours] = useState({});
  const [periods, setPeriods] = useState({});
  const [totalHours, setTotalHours] = useState(0);
  const [currentWeek, setCurrentWeek] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userData = await retrieveDataFromFirestore(userId);
        if (userData) {
          setHours(userData.hours || {});
        }
      } catch (error) {
        console.error('Error retrieving data from Firestore:', error);
      }
    };

    fetchData();
  }, [userId]);

  useEffect(() => {
    const newPeriods = {};
    let total = 0;

    for (const day of days) {
      const dayHours = hours[day] || {};
      const selectedHours = Object.keys(dayHours).filter(hour => dayHours[hour]).map(Number);

      if (selectedHours.length > 0) {
        const startHour = Math.min(...selectedHours);
        const endHour = Math.max(...selectedHours) + 1;
        const middleHour = Math.floor((startHour + endHour) / 2);
        newPeriods[day] = { period: `${startHour}-${endHour}\n${endHour - startHour} hr`, middleHour };
        total += endHour - startHour;
      }
    }

    setPeriods(newPeriods);
    setTotalHours(total);

    const currentDate = new Date();
    const firstDayOfWeek = new Date(currentDate.setDate(currentDate.getDate() - currentDate.getDay() + 1));
    const lastDayOfWeek = new Date(currentDate.setDate(currentDate.getDate() - currentDate.getDay() + 7));
    const formattedFirstDay = firstDayOfWeek.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    const formattedLastDay = lastDayOfWeek.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    setCurrentWeek(`Current Week (${formattedFirstDay} - ${formattedLastDay} ${lastDayOfWeek.getFullYear()})`);
  }, [hours]);

  const handleInputChange = (day, hour) => {
    const updatedHours = { ...hours, [day]: { ...hours[day], [hour]: !hours[day]?.[hour] } };
    setHours(updatedHours);
    saveDataToFirestore(userId, { hours: updatedHours });
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      console.log('User logged out successfully');
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const saveDataToFirestore = async (userId, data) => {
    const userDocRef = doc(db, 'users', userId);
    await setDoc(userDocRef, data);
  };

  const retrieveDataFromFirestore = async (userId) => {
    const userDocRef = doc(db, 'users', userId);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      return null;
    }
  };

  return (
    <div className="main-div">
      <div className="watermark">Total: {totalHours} hr</div>
      <table>
        <thead>
          <tr>
            <th id='weekRow' colSpan={7}>{currentWeek}</th>
          </tr>
          <tr>
            {days.map(day => <th key={day}>{day}</th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 24 }, (_, i) => i).map(hour => (
            <tr key={hour}>
              {days.map(day => (
                <td key={day}>
                  <div
                    className={`hour-block ${hours[day]?.[hour] ? 'selected' : ''}`}
                    onClick={() => handleInputChange(day, hour)}
                  >
                    {!hours[day]?.[hour] && (
                      <>
                        {hour === 0 && <span className="time-marker">00:00</span>}
                        {hour === 6 && <span className="time-marker">06:00</span>}
                        {hour === 12 && <span className="time-marker">12:00</span>}
                        {hour === 18 && <span className="time-marker">18:00</span>}
                      </>
                    )}
                    {periods[day] && hour === periods[day].middleHour && <span className="time-marker" dangerouslySetInnerHTML={{ __html: periods[day].period.replace('\n', '<br />') }} />}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={() => setHours({})}>Clear Selection</button>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}

export default MainPage;
