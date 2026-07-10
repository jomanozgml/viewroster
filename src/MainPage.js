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

const formatHourLabel = hourNum => {
  const isHalf = hourNum % 1 !== 0;
  const h = Math.floor(hourNum);
  const m = isHalf ? '30' : '00';
  return `${String(h).padStart(2, '0')}:${m}`;
};


function MainPage({ userId }) {
  const user = auth.currentUser;
  const [hours, setHours] = useState({}); // Now stores { day: { hour: workId } }
  const [remarks, setRemarks] = useState({}); // { day: { hour: "remark text" } }
  const [remarkModal, setRemarkModal] = useState({ isOpen: false, day: null, hour: null, text: '' });
  const [periods, setPeriods] = useState({});
  const [totalHours, setTotalHours] = useState(0);
  const [workTotals, setWorkTotals] = useState({}); // Stores total hours per work: { 1: 8.5, 2: 12, etc. }
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [extraMinutes, setExtraMinutes] = useState({}); // Now stores { day: { '15min': workId, '30min': workId } }
  const [breaks, setBreaks] = useState({}); // Stores unpaid break: { Mon: { duration: 0.5, workId: 1 }, etc. }
  const [selectedWork, setSelectedWork] = useState(1); // Currently selected work/color
  const [slideDirection, setSlideDirection] = useState(''); // 'slide-left', 'slide-right', or ''
  const [isEditMode, setIsEditMode] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [activeRemarkBubble, setActiveRemarkBubble] = useState(null);
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
              let workId;
              if (typeof value === 'string' && value.includes('-')) {
                workId = Number(value.split('-')[0]);
              } else {
                workId = Number(value);
              }
              // Only keep valid work IDs (1-5)
              if (!isNaN(workId) && workId >= 1 && workId <= 5) {
                dayHours[hour] = value;
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
          setRemarks(userData.remarks || {});
        } else {
          setHours({});
          setExtraMinutes({});
          setBreaks({});
          setRemarks({});
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
        const rawVal = dayHours[hour];
        let workId, modifier;
        if (typeof rawVal === 'string' && rawVal.includes('-')) {
            const parts = rawVal.split('-');
            workId = Number(parts[0]);
            modifier = parts[1];
        } else {
            workId = Number(rawVal);
            modifier = null;
        }
        if (!workBlocks[workId]) workBlocks[workId] = [];
        workBlocks[workId].push({ hour: Number(hour), modifier });
      });

      // Calculate periods for each work block
      const dayPeriods = [];
      let dayTotal = 0;
      Object.entries(workBlocks).forEach(([workIdStr, selectedHourObjs]) => {
        // Skip invalid workIds (old boolean values)
        const workIdNum = Number(workIdStr);
        if (selectedHourObjs.length > 0 && !isNaN(workIdNum) && workIdNum >= 1 && workIdNum <= 5) {
          selectedHourObjs.sort((a, b) => a.hour - b.hour);
          const startObj = selectedHourObjs[0];
          const endObj = selectedHourObjs[selectedHourObjs.length - 1];
          const rawStart = startObj.hour;
          const rawEnd = endObj.hour + 1;

          const startHourObjVal = startObj.modifier === 'startHalf' ? rawStart + 0.5 : rawStart;
          const endHourObjVal = endObj.modifier === 'endHalf' ? rawEnd - 0.5 : rawEnd;

          const middleHour = Math.floor((rawStart + rawEnd - 1) / 2);
          const hoursCount = endHourObjVal - startHourObjVal;
          const work = defaultWorkColors.find(w => w.id === workIdNum);
          dayPeriods.push({
            period: `${work?.name || `Work ${workIdNum}`}\n${startHourObjVal}-${endHourObjVal}\n${hoursCount} hr`,
            middleHour,
            startCell: rawStart,
            endCell: rawEnd - 1,
            startLabelHour: startHourObjVal,
            endLabelHour: endHourObjVal,
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

  const triggerSlide = (direction) => {
    setSlideDirection(`slide-${direction}`);
    setTimeout(() => {
      setSlideDirection('');
    }, 300); // 300ms matches CSS transition
  };

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
    triggerSlide('right');
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
    triggerSlide('left');
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: handleNextWeek,
    onSwipedRight: handlePreviousWeek,
    preventDefaultTouchmoveEvent: true,
    trackMouse: true,
    delta: 100 // Require a longer swipe distance (100px) so it's less sensitive
  });

  useEffect(() => {
    let timer;
    if (toastMessage) {
      timer = setTimeout(() => setToastMessage(''), 5000);
    }
    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    let timer;
    if (activeRemarkBubble) {
      timer = setTimeout(() => setActiveRemarkBubble(null), 5000);
    }
    return () => clearTimeout(timer);
  }, [activeRemarkBubble]);

  const showToast = (msg) => {
    setToastMessage(msg);
  };

  const handleInputChange = async (day, hour) => {
    if (!isEditMode) {
      if (remarks[day]?.[hour]) {
        setActiveRemarkBubble({ day, hour, text: remarks[day][hour] });
      } else {
        showToast("Please turn on Edit Mode using the toggle at the bottom to make changes.");
      }
      return;
    }

    if (selectedWork === 'remark') {
      if (hours[day]?.[hour]) {
        setRemarkModal({ isOpen: true, day, hour, text: remarks[day]?.[hour] || '' });
      } else {
        showToast("Remarks can only be added to selected work blocks.");
      }
      return;
    }

    const rawValue = hours[day]?.[hour];
    let currentValue = rawValue;
    let modifier = null;
    if (typeof rawValue === 'string' && rawValue.includes('-')) {
      const parts = rawValue.split('-');
      currentValue = Number(parts[0]);
      modifier = parts[1];
    } else {
      currentValue = Number(rawValue);
    }

    let updatedHours = { ...hours };
    const isSelectedWork = currentValue === selectedWork;

    // Toggle: if already selected with same work, toggle to half or remove it; otherwise set to selected work
    if (isSelectedWork) {
      // Determine block position
      const prevVal = hours[day]?.[hour - 1];
      const hasPrev = prevVal && (prevVal === selectedWork || String(prevVal).startsWith(`${selectedWork}-`));

      const nextVal = hours[day]?.[hour + 1];
      const hasNext = nextVal && (nextVal === selectedWork || String(nextVal).startsWith(`${selectedWork}-`));

      const isIsolated = !hasPrev && !hasNext;
      const isStart = !hasPrev && hasNext;
      const isEnd = hasPrev && !hasNext;

      let nextModifier = null;
      let shouldDelete = false;
      let shouldDeleteBelow = false;

      if (isIsolated) {
        if (!modifier) nextModifier = 'startHalf';
        else shouldDelete = true;
      } else if (isStart) {
        if (!modifier) nextModifier = 'startHalf';
        else shouldDelete = true;
      } else if (isEnd) {
        if (!modifier) nextModifier = 'endHalf';
        else shouldDelete = true;
      } else {
        shouldDelete = true;
        shouldDeleteBelow = true;
      }

      if (updatedHours[day]) {
        const newDayHours = { ...updatedHours[day] };
        if (shouldDelete) {
          delete newDayHours[hour];
          if (shouldDeleteBelow) {
            let nextHour = hour + 1;
            while (
              newDayHours[nextHour] &&
              (newDayHours[nextHour] === selectedWork || String(newDayHours[nextHour]).startsWith(`${selectedWork}-`))
            ) {
              delete newDayHours[nextHour];
              nextHour++;
            }
          }
        } else {
          newDayHours[hour] = nextModifier ? `${selectedWork}-${nextModifier}` : selectedWork;
        }

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
        .filter(h => {
           const v = updatedHours[day][h];
           return v === selectedWork || String(v).startsWith(`${selectedWork}-`);
        })
        .map(Number);

      if (sameWorkHours.length > 1) {
        const startHour = Math.min(...sameWorkHours);
        const endHour = Math.max(...sameWorkHours);
        for (let i = startHour + 1; i < endHour; i++) {
          const cellVal = updatedHours[day][i];
          const isSameWork = cellVal === selectedWork || String(cellVal).startsWith(`${selectedWork}-`);
          // Only fill if empty or same work type
          if (!cellVal || isSameWork) {
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
        breaks: breaks,
        remarks: remarks
      },
      currentWeek.index,
      currentWeek.year
    );
  };

  const handleExtraMinutes = async (day, duration) => {
    if (!isEditMode) {
      showToast("Please turn on Edit Mode using the toggle at the bottom to make changes.");
      return;
    }
    if (selectedWork === 'remark') return;

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
        breaks: breaks,
        remarks: remarks
      },
      currentWeek.index,
      currentWeek.year
    );
  };

  const handleBreakChange = async (day, duration) => {
    if (!isEditMode) {
      showToast("Please turn on Edit Mode using the toggle at the bottom to make changes.");
      return;
    }
    if (selectedWork === 'remark') return;

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
        breaks: updatedBreaks,
        remarks: remarks
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
        breaks: {},
        remarks: remarks
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

  const isCurrentWeek = () => {
    const { week, year } = getCurrentWeekAndYear();
    return currentWeek.index === week && currentWeek.year === year;
  };

  const getTodayDayName = () => {
    if (!isCurrentWeek()) return null;
    const dayIndex = (new Date().getDay() + 6) % 7;
    return days[dayIndex];
  };

  const todayHeader = getTodayDayName();

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

  const updateRemarkEntry = (sourceRemarks, day, hour, text) => {
    const updatedRemarks = { ...sourceRemarks };
    const dayRemarks = { ...(updatedRemarks[day] || {}) };

    if (text.trim()) {
      dayRemarks[hour] = text;
      updatedRemarks[day] = dayRemarks;
    } else {
      delete dayRemarks[hour];
      if (Object.keys(dayRemarks).length === 0) {
        delete updatedRemarks[day];
      } else {
        updatedRemarks[day] = dayRemarks;
      }
    }

    return updatedRemarks;
  };

  const saveRemark = async () => {
    const updatedRemarks = updateRemarkEntry(remarks, remarkModal.day, remarkModal.hour, remarkModal.text);
    setRemarks(updatedRemarks);
    setRemarkModal({ isOpen: false, day: null, hour: null, text: '' });
    await saveDataToFirestore(
      userId,
      { hours, extraMinutes, breaks, remarks: updatedRemarks },
      currentWeek.index,
      currentWeek.year
    );
  };

  const deleteRemark = async () => {
    const updatedRemarks = updateRemarkEntry(remarks, remarkModal.day, remarkModal.hour, '');
    setRemarks(updatedRemarks);
    setRemarkModal({ isOpen: false, day: null, hour: null, text: '' });
    await saveDataToFirestore(
      userId,
      { hours, extraMinutes, breaks, remarks: updatedRemarks },
      currentWeek.index,
      currentWeek.year
    );
  };



  return (
    <div className={`main-div ${slideDirection} ${isEditMode ? 'edit-mode' : 'view-mode'}`} {...swipeHandlers}>
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
            {days.map(day => (
              <th
                key={day}
                className={day === todayHeader ? 'current-day-label' : ''}
              >
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 24 }, (_, i) => i).map(hour => (
            <tr key={hour}>
              {days.map(day => {
                const rawVal = hours[day]?.[hour];
                let workId;
                let modifier = null;
                if (typeof rawVal === 'string' && rawVal.includes('-')) {
                  const parts = rawVal.split('-');
                  workId = Number(parts[0]);
                  modifier = parts[1];
                } else {
                  workId = Number(rawVal);
                }
                const work = workId ? defaultWorkColors.find(w => w.id === workId) : null;
                const isSelected = !!workId;

                let backgroundStyle = {};
                if (isSelected && work) {
                  if (modifier === 'startHalf') {
                    backgroundStyle = { background: `linear-gradient(to bottom, transparent 50%, ${work.color} 50%)` };
                  } else if (modifier === 'endHalf') {
                    backgroundStyle = { background: `linear-gradient(to bottom, ${work.color} 50%, transparent 50%)` };
                  } else {
                    backgroundStyle = { backgroundColor: work.color };
                  }
                }

                // Find if this hour is part of a period and if it's the middle
                const periodInfo = periods[day]?.find(p =>
                  hour >= p.startCell && hour <= p.endCell && p.workId === workId
                );
                const isMiddleOfPeriod = periodInfo && hour === periodInfo.middleHour;
                const isPeriodStart = periodInfo && hour === periodInfo.startCell;
                const isPeriodEnd = periodInfo && hour === periodInfo.endCell;
                const endDisplayHour = isPeriodEnd ? periodInfo.endLabelHour : null;
                const endDisplayHourNormalized = endDisplayHour === null ? null : endDisplayHour % 24;
                const isMarkerHour = hourValue => hourValue === 0 || hourValue === 6 || hourValue === 12 || hourValue === 18;
                const shouldHideEndBoundary =
                  endDisplayHour === 24 ||
                  (endDisplayHourNormalized !== null && isMarkerHour(endDisplayHourNormalized));
                const showEndBoundary = isPeriodEnd && !shouldHideEndBoundary;

                // Check if the previous hour was a period end, because its label will be drawn in THIS cell
                let prevShowEndBoundary = false;
                if (hour > 0) {
                  const prevRawVal = hours[day]?.[hour - 1];
                  let prevWorkId;
                  if (typeof prevRawVal === 'string' && prevRawVal.includes('-')) {
                    prevWorkId = Number(prevRawVal.split('-')[0]);
                  } else {
                    prevWorkId = Number(prevRawVal);
                  }
                  if (prevWorkId) {
                    const prevPeriodInfo = periods[day]?.find(p =>
                      (hour - 1) >= p.startCell && (hour - 1) <= p.endCell && p.workId === prevWorkId
                    );
                    if (prevPeriodInfo && (hour - 1) === prevPeriodInfo.endCell) {
                      const prevEndDisplayHour = prevPeriodInfo.endLabelHour;
                      const prevEndDisplayHourNorm = prevEndDisplayHour % 24;
                      const prevShouldHide = prevEndDisplayHour === 24 || isMarkerHour(prevEndDisplayHourNorm);
                      if (!prevShouldHide) {
                        prevShowEndBoundary = true;
                      }
                    }
                  }
                }

                const showRegularMarker =
                  isMarkerHour(hour) &&
                  !isPeriodStart &&
                  !isPeriodEnd &&
                  !isSelected &&
                  !prevShowEndBoundary;

                const startBoundaryLabel = isPeriodStart ? formatHourLabel(periodInfo.startLabelHour) : '';
                const endBoundaryLabel = showEndBoundary ? formatHourLabel(endDisplayHourNormalized) : '';

                const isActiveBubble = activeRemarkBubble?.day === day && activeRemarkBubble?.hour === hour;

                return (
                  <td key={day}>
                    <div
                      className={`hour-block ${isSelected ? 'selected' : ''}`}
                      style={{ ...backgroundStyle, zIndex: isActiveBubble ? 1000 : 'auto' }}
                      onClick={() => handleInputChange(day, hour)}
                    >
                      {isPeriodStart && (
                        <span className={`time-marker boundary-time-marker ${modifier === 'startHalf' ? 'half-start-marker' : ''}`}>
                          {startBoundaryLabel}
                        </span>
                      )}
                      {showEndBoundary && (
                        <span className={`time-marker boundary-time-marker end-boundary-marker ${modifier === 'endHalf' ? 'half-end-marker' : ''}`}>
                          {endBoundaryLabel}
                        </span>
                      )}
                      {showRegularMarker && (
                        <span className="time-marker">
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
                      {remarks[day]?.[hour] && (
                        <span
                          className="remark-indicator"
                          onClick={(e) => {
                            if (isEditMode && selectedWork !== 'remark') {
                              // If they click the indicator while in edit mode but not remark mode, show bubble
                              e.stopPropagation();
                              setActiveRemarkBubble({ day, hour, text: remarks[day][hour] });
                            }
                          }}
                        >
                          💬
                        </span>
                      )}

                      {activeRemarkBubble?.day === day && activeRemarkBubble?.hour === hour && (
                        <div className="remark-bubble" onClick={(e) => e.stopPropagation()}>
                          <div className="remark-bubble-text">{activeRemarkBubble.text}</div>
                          <button className="remark-bubble-close" onClick={() => setActiveRemarkBubble(null)}>✕</button>
                        </div>
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
      <div className={`work-selector ${isEditMode ? '' : 'hidden'}`}>
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
        <div
          className={`work-color-box remark-selector-btn ${selectedWork === 'remark' ? 'active' : ''}`}
          style={{ backgroundColor: '#666', fontSize: '1.5em' }}
          onClick={() => setSelectedWork('remark')}
          title="Add/Edit Remark"
        >
          📝
        </div>
      </div>
      <div className="bottom-controls">
        <div className="mode-toggle">
          <label>
            <input
              type="checkbox"
              checked={isEditMode}
              onChange={(e) => setIsEditMode(e.target.checked)}
            />
            <span className="slider"></span>
            Edit Mode
          </label>
        </div>

        <div className={`action-buttons ${isEditMode ? '' : 'hidden'}`}>
          <button className="clear-btn" onClick={handleClearSelection}>Clear Week</button>
        </div>

        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </div>
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
      {showConfirmDialog && (
        <div className="confirm-dialog-overlay">
          <div className="confirm-dialog">
            <p>This will clear all selections for this week!</p>
            <div className="confirm-dialog-buttons">
              <button onClick={confirmClear}>Confirm</button>
              <button onClick={() => setShowConfirmDialog(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {remarkModal.isOpen && (
        <div className="confirm-dialog-overlay">
          <div className="confirm-dialog">
            <p>Remark for {remarkModal.day} {formatHourLabel(remarkModal.hour)}</p>
            <textarea
              className="rename-input"
              rows="3"
              value={remarkModal.text}
              onChange={(e) => setRemarkModal({ ...remarkModal, text: e.target.value })}
              placeholder="e.g. Support Work at City Hall"
              autoFocus
            />
            <div className="confirm-dialog-buttons">
              <button onClick={saveRemark}>Save</button>
              <button onClick={deleteRemark}>Delete</button>
              <button onClick={() => setRemarkModal({ isOpen: false, day: null, hour: null, text: '' })}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {toastMessage && (
        <div className="toast-overlay" onClick={() => setToastMessage('')}>
          <div className="toast-message" onClick={(e) => e.stopPropagation()}>
            {toastMessage}
          </div>
        </div>
      )}
      <footer className="user-info">
        <span>{user?.email}</span>
      </footer>
    </div>
  );
}

export default MainPage;