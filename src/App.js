// import logo from './logo.svg';
// import './App.css';

// function App() {
//   return (
//     <div className="App">
//       <header className="App-header">
//         <img src={logo} className="App-logo" alt="logo" />
//         <p>
//           Edit <code>src/App.js</code> and save to reload.
//         </p>
//         <a
//           className="App-link"
//           href="https://reactjs.org"
//           target="_blank"
//           rel="noopener noreferrer"
//         >
//           Learn React with Firebase
//         </a>
//       </header>
//     </div>
//   );
// }

// export default App;

import React, { useState } from 'react';
import './App.css'; // Import your CSS file

function App() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const [hours, setHours] = useState({});

  const handleInputChange = (day, hour) => {
    setHours({ ...hours, [day]: { ...hours[day], [hour]: !hours[day]?.[hour] } });
  };

  return (
    <div className="App">
      <table>
        <thead>
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
                    {hour === 0 && <span className="time-marker">00:00</span>}
                    {hour === 6 && <span className="time-marker">06:00</span>}
                    {hour === 12 && <span className="time-marker">12:00</span>}
                    {hour === 18 && <span className="time-marker">18:00</span>}
                    {hour === 24 && <span className="time-marker">24:00</span>}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;