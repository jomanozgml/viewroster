import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSwipeable } from 'react-swipeable';
import './MainPage.css';
import firebase from 'firebase/compat/app';
import { getAuth, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';

firebase.initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const getCurrentWeekNumber = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = (now - start) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  return Math.ceil(dayOfYear / 7) - 1;
};

function MainPage({ userId }) {
  const [hours, setHours] = useState({});
  const [periods, setPeriods] = useState({});
  const [totalHours, setTotalHours] = useState(0);
  const [currentWeek, setCurrentWeek] = useState({ index: getCurrentWeekNumber(), startDate: null, endDate: null });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userData = await retrieveDataFromFirestore(userId, currentWeek.index);
        if (userData) {
          setHours(userData.hours || {});
        }
      } catch (error) {
        console.error('Error retrieving data from Firestore:', error);
      }
    };

    fetchData();
  }, [userId, currentWeek.index]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const currentWeekNumber = getCurrentWeekNumber();
      if (currentWeek.index !== currentWeekNumber) {
        setCurrentWeek(prevWeek => ({ ...prevWeek, index: currentWeekNumber }));
      }
    }, 1000 * 60 * 60); // Check every hour

    return () => clearInterval(intervalId); // Clean up on unmount
  }, [currentWeek.index]);

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

    const startDate = new Date();
    startDate.setDate(1); // Set the date to the 1st day of the month
    startDate.setMonth(0); // Set the month to January
    while (startDate.getDay() !== 1) {
      startDate.setDate(startDate.getDate() + 1); // Find the first Monday of the month
    }
    const currentDay = startDate.getDay(); // Get the current day of the week (0-6)
    const diff = currentDay === 0 ? 6 : currentDay - 1; // Get the difference between the current day and Monday
    startDate.setDate(startDate.getDate() - diff + (currentWeek.index * 7));

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    const formattedStartDate = startDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    const formattedEndDate = endDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    setCurrentWeek(prevWeek => ({ ...prevWeek, startDate: formattedStartDate, endDate: formattedEndDate }));
  }, [hours, currentWeek.index]);

  const handlePreviousWeek = () => {
    setCurrentWeek(prevWeek => ({ ...prevWeek, index: prevWeek.index - 1 }));
  };

  const handleNextWeek = () => {
    setCurrentWeek(prevWeek => ({ ...prevWeek, index: prevWeek.index + 1 }));
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: handleNextWeek,
    onSwipedRight: handlePreviousWeek,
    preventDefaultTouchmoveEvent: true,
    trackMouse: true
  });

  const handleInputChange = (day, hour) => {
    const updatedHours = { ...hours, [day]: { ...hours[day], [hour]: !hours[day]?.[hour] } };
    setHours(updatedHours);
    saveDataToFirestore(userId, { hours: updatedHours }, currentWeek.index);

    // Check if there are previously selected hours in the same day
    const selectedHours = Object.keys(updatedHours[day]).filter(hour => updatedHours[day][hour]).map(Number);
    if (selectedHours.length > 1) {
      const startHour = Math.min(...selectedHours);
      const endHour = Math.max(...selectedHours);
      for (let i = startHour + 1; i < endHour; i++) {
        updatedHours[day][i] = true;
      }
      setHours(updatedHours);
      saveDataToFirestore(userId, { hours: updatedHours }, currentWeek.index);
    }
  };

  const handleClearSelection = () => {
    setHours({});
    saveDataToFirestore(userId, { hours: {} }, currentWeek.index);
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

  const saveDataToFirestore = async (userId, data, weekIndex) => {
    // Assuming each user has a subcollection for weeks, and each week is a document identified by its index
    const weekDocRef = doc(db, 'users', userId, 'weeks', weekIndex.toString());
    await setDoc(weekDocRef, data);
  };

  const retrieveDataFromFirestore = async (userId, weekIndex) => {
    // Fetch the document for the specific week
    const weekDocRef = doc(db, 'users', userId, 'weeks', weekIndex.toString());
    const docSnap = await getDoc(weekDocRef);
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      // Show empty data if the document does not exist
      return {};
    }
  };

  return (
    <div className="main-div" {...swipeHandlers}>
      <div className="watermark">Total: {totalHours} hr</div>
      <table>
        <thead>
          <tr id='weekRowHeader'>
            <th className="arrow-btn" onClick={handlePreviousWeek}>{'<'}</th>
            <th id='weekRow' colSpan={5}>{currentWeek.startDate} - {currentWeek.endDate}</th>
            <th className="arrow-btn" onClick={handleNextWeek}>{'>'}</th>
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
      <button onClick={handleClearSelection}>Clear Selection</button>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}

export default MainPage;
