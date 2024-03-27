// import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import './Login.css'; // Import your CSS file

// // Login Page

// function Login() {
//     const [username, setUsername] = useState('');
//     const [password, setPassword] = useState('');
//     const [error, setError] = useState('');
//     const navigate = useNavigate();

//     const handleSubmit = e => {
//         e.preventDefault();
//         // Check if username and password inputs are empty
//         if (username === '' || password === '') {
//             setError('Please enter username and password');
//         } else if (username === 'admin' && password === 'password') {
//             navigate('/app');
//         } else {
//             setError('Invalid credentials');
//         }
//     };

//     return (
//         <div className="login-container">
//             <h2 className="login-title">Login</h2>
//             <form className="login-form" onSubmit={handleSubmit}>
//                 <label className="login-label">
//                     Username:
//                     <input className="login-input" type="text" value={username} onChange={e => setUsername(e.target.value)} required />
//                 </label>
//                 <label className="login-label">
//                     Password:
//                     <input className="login-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
//                 </label>
//                 <button className="login-button" type="submit">Login</button>
//                 {error && <p className="login-error">{error}</p>}
//             </form>
//         </div>
//     );
// }

// export default Login;
