import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSwipeable } from 'react-swipeable';
import firebase from 'firebase/compat/app';
import { getAuth, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';
import './MainPage.css';

const app = firebase.initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const defaultWorkColors = [
  { id: 1, name: 'Work 1', color: '#4CAF50' },
  { id: 2, name: 'Work 2', color: '#2196F3' },
  { id: 3, name: 'Work 3', color: '#FFB74D' },
  { id: 4, name: 'Work 4', color: '#BA68C8' },
  { id: 5, name: 'Work 5', color: '#E57373' }
];

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
  let weekNumber = Math.floor(diff / oneWeek) + 1;

  // Check if this week spills into the next year
  const lastDayOfYear = new Date(now.getFullYear(), 11, 31);
  const lastWeekMonday = new Date(lastDayOfYear);
  while (lastWeekMonday.getDay() !== 1) {
    lastWeekMonday.setDate(lastWeekMonday.getDate() - 1);
  }

  if (now >= lastWeekMonday) {
    weekNumber = Math.ceil((lastDayOfYear - firstMonday) / oneWeek) + 1;
  }

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
  startDate.setDate(startDate.getDate() + (weekNumber - 1) * 7);

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
  const [hours, setHours] = useState({}); // Now stores { day: { hour: workId } }
  const [periods, setPeriods] = useState({});
  const [totalHours, setTotalHours] = useState(0);
  const [workTotals, setWorkTotals] = useState({}); // Stores total hours per work: { 1: 8.5, 2: 12, etc. }
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [extraMinutes, setExtraMinutes] = useState({}); // Now stores { day: { '15min': workId, '30min': workId } }
  const [breaks, setBreaks] = useState({}); // Stores unpaid break: { Mon: { duration: 0.5, workId: 1 }, etc. }
  const [selectedWork, setSelectedWork] = useState(1); // Currently selected work/color
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

  // Load week-specific data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const userData = await retrieveDataFromFirestore(userId, currentWeek.index, currentWeek.year);
        if (userData) {
          // Clean up old boolean values and keep only valid work IDs (1-5)
          const cleanedHours = {};
          Object.keys(userData.hours || {}).forEach(day => {
            const dayHours = {};
            Object.keys(userData.hours[day] || {}).forEach(hour => {
              const value = userData.hours[day][hour];
              const workId = Number(value);
              // Only keep valid work IDs (1-5)
              if (!isNaN(workId) && workId >= 1 && workId <= 5) {
                dayHours[hour] = workId;
              }
            });
            if (Object.keys(dayHours).length > 0) {
              cleanedHours[day] = dayHours;
            }
          });

          // Clean up extra minutes
          const cleanedExtraMinutes = {};
          Object.keys(userData.extraMinutes || {}).forEach(day => {
            const dayMinutes = {};
            Object.keys(userData.extraMinutes[day] || {}).forEach(duration => {
              const value = userData.extraMinutes[day][duration];
              const workId = Number(value);
              // Only keep valid work IDs (1-5)
              if (!isNaN(workId) && workId >= 1 && workId <= 5) {
                dayMinutes[duration] = workId;
              }
            });
            if (Object.keys(dayMinutes).length > 0) {
              cleanedExtraMinutes[day] = dayMinutes;
            }
          });

          setHours(cleanedHours);
          setExtraMinutes(cleanedExtraMinutes);
          setBreaks(userData.breaks || {});
        } else {
          setHours({});
          setExtraMinutes({});
          setBreaks({});
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
    const workHoursTotals = {}; // Track hours per work type

    // Calculate hours for each work type per day
    for (const day of days) {
      const dayHours = hours[day] || {};
      const workBlocks = {}; // Group hours by work type

      Object.keys(dayHours).forEach(hour => {
        const workId = dayHours[hour];
        if (!workBlocks[workId]) workBlocks[workId] = [];
        workBlocks[workId].push(Number(hour));
      });

      // Calculate periods for each work block
      const dayPeriods = [];
      let dayTotal = 0;
      Object.entries(workBlocks).forEach(([workId, selectedHours]) => {
        // Skip invalid workIds (old boolean values)
        const workIdNum = Number(workId);
        if (selectedHours.length > 0 && !isNaN(workIdNum) && workIdNum >= 1 && workIdNum <= 5) {
          selectedHours.sort((a, b) => a - b);
          const startHour = Math.min(...selectedHours);
          const endHour = Math.max(...selectedHours) + 1;
          const middleHour = Math.floor((startHour + endHour) / 2);
          const hoursCount = endHour - startHour;
          const work = defaultWorkColors.find(w => w.id === workIdNum);
          dayPeriods.push({
            period: `${work?.name || `Work ${workIdNum}`}\n${startHour}-${endHour}\n${hoursCount} hr`,
            middleHour,
            startHour,
            endHour: endHour - 1,
            hoursCount,
            workId: workIdNum,
            color: work?.color || '#4CAF50'
          });
          dayTotal += hoursCount;
          // Track hours per work
          if (!workHoursTotals[workIdNum]) workHoursTotals[workIdNum] = 0;
          workHoursTotals[workIdNum] += hoursCount;
        }
      });

      total += dayTotal;

      if (dayPeriods.length > 0) {
        newPeriods[day] = dayPeriods;
      }

      // Add extra minutes
      if (extraMinutes[day]) {
        if (extraMinutes[day]['15min']) {
          total += 0.25;
          const workId = extraMinutes[day]['15min'];
          if (!workHoursTotals[workId]) workHoursTotals[workId] = 0;
          workHoursTotals[workId] += 0.25;
        }
        if (extraMinutes[day]['30min']) {
          total += 0.5;
          const workId = extraMinutes[day]['30min'];
          if (!workHoursTotals[workId]) workHoursTotals[workId] = 0;
          workHoursTotals[workId] += 0.5;
        }
      }

      // Deduct unpaid break time
      if (breaks[day]) {
        total -= breaks[day].duration;
        const workId = breaks[day].workId;
        if (workHoursTotals[workId]) {
          workHoursTotals[workId] -= breaks[day].duration;
        }
      }
    }

    setPeriods(newPeriods);
    setTotalHours(total);
    setWorkTotals(workHoursTotals);
  }, [hours, extraMinutes, breaks]);

  const handlePreviousWeek = () => {
    setCurrentWeek(prevWeek => {
      let newWeek = prevWeek.index - 1;
      let newYear = prevWeek.year;

      if (newWeek < 1) {
        newYear -= 1;
        const totalWeeksLastYear = Math.ceil(
          (new Date(newYear, 11, 31) - new Date(newYear, 0, 1)) / (1000 * 60 * 60 * 24 * 7)
        );
        newWeek = totalWeeksLastYear;
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

      const totalWeeksThisYear = Math.ceil(
        (new Date(newYear, 11, 31) - new Date(newYear, 0, 1)) / (1000 * 60 * 60 * 24 * 7)
      );

      if (newWeek > totalWeeksThisYear) {
        newWeek = 1;
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

  const handleInputChange = async (day, hour) => {
    const currentValue = hours[day]?.[hour];
    let updatedHours;

    // Toggle: if already selected with same work, remove it; otherwise set to selected work
    if (currentValue === selectedWork) {
      // Remove this hour
      updatedHours = { ...hours };
      if (updatedHours[day]) {
        const newDayHours = { ...updatedHours[day] };
        delete newDayHours[hour];
        // If day is now empty, remove the day entirely
        if (Object.keys(newDayHours).length === 0) {
          delete updatedHours[day];
        } else {
          updatedHours[day] = newDayHours;
        }
      }
    } else {
      // Set to selected work
      updatedHours = { ...hours, [day]: { ...hours[day], [hour]: selectedWork } };

      // Auto-fill intermediate hours for the same work type
      const sameWorkHours = Object.keys(updatedHours[day])
        .filter(h => updatedHours[day][h] === selectedWork)
        .map(Number);

      if (sameWorkHours.length > 1) {
        const startHour = Math.min(...sameWorkHours);
        const endHour = Math.max(...sameWorkHours);
        for (let i = startHour + 1; i < endHour; i++) {
          // Only fill if empty or same work type
          if (!updatedHours[day][i] || updatedHours[day][i] === selectedWork) {
            updatedHours[day][i] = selectedWork;
          }
        }
      }
    }

    setHours(updatedHours);
    await saveDataToFirestore(
      userId,
      {
        hours: updatedHours,
        extraMinutes: extraMinutes,
        breaks: breaks
      },
      currentWeek.index,
      currentWeek.year
    );
  };

  const handleExtraMinutes = async (day, duration) => {
    const currentValue = extraMinutes[day]?.[duration];
    let updatedExtraMinutes;

    // Toggle: if already selected with same work, remove it; otherwise set to selected work
    if (currentValue === selectedWork) {
      updatedExtraMinutes = { ...extraMinutes };
      if (updatedExtraMinutes[day]) {
        const newDayMinutes = { ...updatedExtraMinutes[day] };
        delete newDayMinutes[duration];
        updatedExtraMinutes[day] = newDayMinutes;
      }
    } else {
      updatedExtraMinutes = {
        ...extraMinutes,
        [day]: {
          ...extraMinutes[day],
          [duration]: selectedWork
        }
      };
    }

    setExtraMinutes(updatedExtraMinutes);
    await saveDataToFirestore(
      userId,
      {
        hours: hours,
        extraMinutes: updatedExtraMinutes,
        breaks: breaks
      },
      currentWeek.index,
      currentWeek.year
    );
  };

  const handleBreakChange = async (day, duration) => {
    const updatedBreaks = { ...breaks };
    const currentBreak = breaks[day];

    if (currentBreak?.duration === duration && currentBreak?.workId === selectedWork) {
      // If clicking the same break with same work, remove it
      delete updatedBreaks[day];
    } else {
      // Set new break duration with selected work
      updatedBreaks[day] = { duration, workId: selectedWork };
    }

    setBreaks(updatedBreaks);
    await saveDataToFirestore(
      userId,
      {
        hours: hours,
        extraMinutes: extraMinutes,
        breaks: updatedBreaks
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
    setBreaks({});
    saveDataToFirestore(
      userId,
      {
        hours: {},
        extraMinutes: {},
        breaks: {}
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
    try {
      const yearDocRef = doc(db, 'users', userId, 'years', year.toString());
      const yearDoc = await getDoc(yearDocRef);

      const existingWeeks = yearDoc.exists() ? yearDoc.data()?.weeks || {} : {};

      // Replace the entire week data, not merge
      const updatedWeeks = {
        ...existingWeeks,
        [weekIndex]: data
      };

      await setDoc(yearDocRef, { weeks: updatedWeeks });

      console.log('Data saved successfully', data);
    } catch (error) {
      console.error('Error saving data to Firestore:', error);
    }
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
              {days.map(day => {
                const workId = hours[day]?.[hour];
                const work = workId ? defaultWorkColors.find(w => w.id === workId) : null;
                const isSelected = !!workId;

                // Find if this hour is part of a period and if it's the middle
                const periodInfo = periods[day]?.find(p =>
                  hour >= p.startHour && hour <= p.endHour && p.workId === workId
                );
                const isMiddleOfPeriod = periodInfo && hour === periodInfo.middleHour;

                return (
                  <td key={day}>
                    <div
                      className={`hour-block ${isSelected ? 'selected' : ''}`}
                      style={isSelected ? { backgroundColor: work?.color } : {}}
                      onClick={() => handleInputChange(day, hour)}
                    >
                      {(hour === 0 || hour === 6 || hour === 12 || hour === 18) && (
                        <span className="time-marker" style={isSelected ? { color: '#666' } : {}}>
                          {hour === 0 && '00:00'}
                          {hour === 6 && '06:00'}
                          {hour === 12 && '12:00'}
                          {hour === 18 && '18:00'}
                        </span>
                      )}
                      {isMiddleOfPeriod && (
                        <span className="diagonal-hours" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                          {periodInfo.hoursCount} hr
                        </span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="extra-minutes-row">
            {days.map(day => {
              const work15 = extraMinutes[day]?.['15min'];
              const work30 = extraMinutes[day]?.['30min'];
              const color15 = work15 ? defaultWorkColors.find(w => w.id === work15)?.color : null;
              const color30 = work30 ? defaultWorkColors.find(w => w.id === work30)?.color : null;

              return (
                <td key={day}>
                  <div className="extra-minutes-container">
                    <div
                      className={`extra-minute-block ${work15 ? 'selected' : ''}`}
                      style={work15 ? { backgroundColor: color15 } : {}}
                      onClick={() => handleExtraMinutes(day, '15min')}
                    >
                      15min
                    </div>
                    <div
                      className={`extra-minute-block ${work30 ? 'selected' : ''}`}
                      style={work30 ? { backgroundColor: color30 } : {}}
                      onClick={() => handleExtraMinutes(day, '30min')}
                    >
                      30min
                    </div>
                  </div>
                </td>
              );
            })}
          </tr>
          <tr className="break-row">
            {days.map((day, index) => {
              const dayBreak = breaks[day];
              const breakWorkColor = dayBreak?.workId ? defaultWorkColors.find(w => w.id === dayBreak.workId)?.color : null;

              return (
                <td key={day}>
                  {index === 0 && (
                    <div className="break-row-label">Unpaid Break</div>
                  )}
                  <div className="break-container">
                    <div
                      className={`break-block ${dayBreak?.duration === 0.5 ? 'selected' : ''}`}
                      style={dayBreak?.duration === 0.5 ? { backgroundColor: breakWorkColor } : {}}
                      onClick={() => handleBreakChange(day, 0.5)}
                    >
                      -30min
                    </div>
                    <div
                      className={`break-block ${dayBreak?.duration === 1 ? 'selected' : ''}`}
                      style={dayBreak?.duration === 1 ? { backgroundColor: breakWorkColor } : {}}
                      onClick={() => handleBreakChange(day, 1)}
                    >
                      -1hr
                    </div>
                  </div>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
      <div className="work-selector">
        <span className="work-selector-label">Select Work:</span>
        {defaultWorkColors.map(work => (
          <div
            key={work.id}
            className={`work-color-box ${selectedWork === work.id ? 'active' : ''}`}
            style={{ backgroundColor: work.color }}
            onClick={() => setSelectedWork(work.id)}
            title={work.name}
          >
            {work.id}
          </div>
        ))}
      </div>
      <button onClick={handleClearSelection}>Clear Selection</button>
      <button onClick={handleLogout}>Logout</button>
      <div className="work-totals-bottom">
        {defaultWorkColors.map(work => {
          const hours = workTotals[work.id] || 0;
          if (hours > 0) {
            return (
              <span key={work.id} style={{ color: work.color }}>
                {work.name}: {hours.toFixed(2)} hr
              </span>
            );
          }
          return null;
        })}
      </div>
      {showConfirmDialog && <ConfirmDialog />}
      <footer className="user-info">
        <span>{user?.email}</span>
      </footer>
    </div>
  );
}

export default MainPage;