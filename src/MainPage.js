import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSwipeable } from 'react-swipeable';
import firebase from 'firebase/compat/app';
import { getAuth, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';
import './MainPage.css';

firebase.initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const getCurrentWeekAndYear = () => {
  const now = new Date();
  const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
  const firstMonday = new Date(firstDayOfYear);

  // Find the first Monday of the year
  while (firstMonday.getDay() !== 1) {
    firstMonday.setDate(firstMonday.getDate() + 1);
  }

  // Calculate the week number
  const diff = now.getTime() - firstMonday.getTime();
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  const weekNumber = Math.floor(diff / oneWeek);

  return {
    week: weekNumber,
    year: now.getFullYear()
  };
};

const getWeekDates = (weekNumber, year) => {
  const firstDayOfYear = new Date(year, 0, 1);
  const firstMonday = new Date(firstDayOfYear);

  // Find the first Monday of the year
  while (firstMonday.getDay() !== 1) {
    firstMonday.setDate(firstMonday.getDate() + 1);
  }

  // Calculate the start date of the specified week
  const startDate = new Date(firstMonday);
  startDate.setDate(startDate.getDate() + (weekNumber * 7));

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);

  return {
    startDate: startDate.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short'
    }),
    endDate: endDate.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short'
    }),
    year: year
  };
};

function MainPage({ userId }) {
  const user = auth.currentUser;
  const [hours, setHours] = useState({});
  const [periods, setPeriods] = useState({});
  const [totalHours, setTotalHours] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [extraMinutes, setExtraMinutes] = useState({});
  const [currentWeek, setCurrentWeek] = useState(() => {
    const { week, year } = getCurrentWeekAndYear();
    const dates = getWeekDates(week, year);
    return {
      index: week,
      year: year,
      ...dates
    };
  });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userData = await retrieveDataFromFirestore(userId, currentWeek.index, currentWeek.year);
        if (userData) {
          setHours(userData.hours || {});
          setExtraMinutes(userData.extraMinutes || {});
        } else {
          setHours({});
          setExtraMinutes({});
        }
      } catch (error) {
        console.error('Error retrieving data from Firestore:', error);
      }
    };

    fetchData();
  }, [userId, currentWeek.index, currentWeek.year]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const { week, year } = getCurrentWeekAndYear();
      if (currentWeek.index !== week || currentWeek.year !== year) {
        const dates = getWeekDates(week, year);
        setCurrentWeek({
          index: week,
          year: year,
          ...dates
        });
      }
    }, 1000 * 60 * 60);

    return () => clearInterval(intervalId);
  }, [currentWeek.index, currentWeek.year]);

  useEffect(() => {
    const newPeriods = {};
    let total = 0;

    // Calculate full hours
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

      // Add extra minutes
      if (extraMinutes[day]) {
        if (extraMinutes[day]['15min']) total += 0.25;
        if (extraMinutes[day]['30min']) total += 0.5;
      }
    }

    setPeriods(newPeriods);
    setTotalHours(total);
  }, [hours, extraMinutes]);

  const handlePreviousWeek = () => {
    setCurrentWeek(prevWeek => {
      let newWeek = prevWeek.index - 1;
      let newYear = prevWeek.year;

      if (newWeek < 0) {
        newWeek = 51;
        newYear -= 1;
      }

      const dates = getWeekDates(newWeek, newYear);
      return {
        index: newWeek,
        year: newYear,
        ...dates
      };
    });
  };

  const handleNextWeek = () => {
    setCurrentWeek(prevWeek => {
      let newWeek = prevWeek.index + 1;
      let newYear = prevWeek.year;

      if (newWeek > 51) {
        newWeek = 0;
        newYear += 1;
      }

      const dates = getWeekDates(newWeek, newYear);
      return {
        index: newWeek,
        year: newYear,
        ...dates
      };
    });
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

    const selectedHours = Object.keys(updatedHours[day])
      .filter(hour => updatedHours[day][hour])
      .map(Number);
    if (selectedHours.length > 1) {
      const startHour = Math.min(...selectedHours);
      const endHour = Math.max(...selectedHours);
      for (let i = startHour + 1; i < endHour; i++) {
        updatedHours[day][i] = true;
      }
    }

    saveDataToFirestore(
      userId,
      {
        hours: updatedHours,
        extraMinutes: extraMinutes
      },
      currentWeek.index,
      currentWeek.year
    );
  };

  const handleExtraMinutes = (day, duration) => {
    const updatedExtraMinutes = {
      ...extraMinutes,
      [day]: {
        ...extraMinutes[day],
        [duration]: !extraMinutes[day]?.[duration]
      }
    };
    setExtraMinutes(updatedExtraMinutes);
    saveDataToFirestore(
      userId,
      {
        hours: hours,
        extraMinutes: updatedExtraMinutes
      },
      currentWeek.index,
      currentWeek.year
    );
  };

  const handleClearSelection = () => {
    setShowConfirmDialog(true);
  };

  const confirmClear = () => {
    setHours({});
    setExtraMinutes({});
    saveDataToFirestore(
      userId,
      {
        hours: {},
        extraMinutes: {}
      },
      currentWeek.index,
      currentWeek.year
    );
    setShowConfirmDialog(false);
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

  const saveDataToFirestore = async (userId, data, weekIndex, year) => {
    const yearDocRef = doc(db, 'users', userId, 'years', year.toString());
    const yearDoc = await getDoc(yearDocRef);

    if (!yearDoc.exists()) {
      await setDoc(yearDocRef, { weeks: {} });
    }

    await setDoc(yearDocRef, {
      weeks: {
        ...yearDoc.data()?.weeks,
        [weekIndex]: data
      }
    }, { merge: true });
  };

  const retrieveDataFromFirestore = async (userId, weekIndex, year) => {
    const yearDocRef = doc(db, 'users', userId, 'years', year.toString());
    const yearDoc = await getDoc(yearDocRef);

    if (yearDoc.exists()) {
      return yearDoc.data().weeks[weekIndex] || {};
    }
    return {};
  };

  const ConfirmDialog = () => (
    <div className="confirm-dialog-overlay">
      <div className="confirm-dialog">
        <p>This will clear all selections for this week!</p>
        <div className="confirm-dialog-buttons">
          <button onClick={confirmClear}>Confirm</button>
          <button onClick={() => setShowConfirmDialog(false)}>Cancel</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="main-div" {...swipeHandlers}>
      <div className="watermark">Total: {totalHours.toFixed(2)} hr</div>
      <table>
        <thead>
          <tr id='weekRowHeader'>
            <th className="arrow-btn" onClick={handlePreviousWeek}>{'<'}</th>
            <th id='weekRow' colSpan={5}>
              {currentWeek.startDate} - {currentWeek.endDate} {currentWeek.year}
            </th>
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
                    {periods[day] && hour === periods[day].middleHour && (
                      <span
                        className="time-marker"
                        dangerouslySetInnerHTML={{
                          __html: periods[day].period.replace('\n', '<br />')
                        }}
                      />
                    )}
                  </div>
                </td>
              ))}
            </tr>
          ))}
          <tr className="extra-minutes-row">
            {days.map(day => (
              <td key={day}>
                <div className="extra-minutes-container">
                  <div
                    className={`extra-minute-block ${extraMinutes[day]?.['15min'] ? 'selected' : ''}`}
                    onClick={() => handleExtraMinutes(day, '15min')}
                  >
                    15min
                  </div>
                  <div
                    className={`extra-minute-block ${extraMinutes[day]?.['30min'] ? 'selected' : ''}`}
                    onClick={() => handleExtraMinutes(day, '30min')}
                  >
                    30min
                  </div>
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <button onClick={handleClearSelection}>Clear Selection</button>
      <button onClick={handleLogout}>Logout</button>
      {showConfirmDialog && <ConfirmDialog />}
      <footer className="user-info">
        <span>{user?.email}</span>
      </footer>
    </div>
  );
}

export default MainPage;