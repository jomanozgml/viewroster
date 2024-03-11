import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './App.css'; // Import your CSS file

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function App() {
  const [hours, setHours] = useState({});
  const [periods, setPeriods] = useState({});
  const [totalHours, setTotalHours] = useState(0);
  const [currentWeek, setCurrentWeek] = useState('');

  const handleInputChange = (day, hour) => {
    setHours({ ...hours, [day]: { ...hours[day], [hour]: !hours[day]?.[hour] } });
  };

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

    // Calculate the current week
    const currentDate = new Date();
    const firstDayOfWeek = new Date(currentDate.setDate(currentDate.getDate() - currentDate.getDay() + 1));
    const lastDayOfWeek = new Date(currentDate.setDate(currentDate.getDate() - currentDate.getDay() + 7));
    const formattedFirstDay = firstDayOfWeek.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    const formattedLastDay = lastDayOfWeek.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    setCurrentWeek(`Current Week (${formattedFirstDay} - ${formattedLastDay} ${lastDayOfWeek.getFullYear()})`);
  }, [hours]);

  return (
    <div className="App">
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
      <Link to="/">Logout</Link>
    </div>
  );
}

export default App;