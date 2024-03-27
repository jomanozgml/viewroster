import React, { useEffect } from 'react';
import './Auth.css';
import firebase from 'firebase/compat/app';
import 'firebaseui/dist/firebaseui.css';
import * as firebaseui from 'firebaseui';

const Auth = () => {
  useEffect(() => {
    // FirebaseUI configuration
    const uiConfig = {
      signInSuccessUrl: '/main',
      signInOptions: [
        firebase.auth.EmailAuthProvider.PROVIDER_ID,
        firebase.auth.GoogleAuthProvider.PROVIDER_ID,
        // Add other sign-in providers as needed
      ],
      // Other configurations as needed
    };

    // Initialize FirebaseUI
    const ui = new firebaseui.auth.AuthUI(firebase.auth());
    ui.start('#firebaseui-auth-container', uiConfig);

    return () => {
      ui.delete();
    };
  }, []); // Ensure dependency array is empty if the effect doesn't depend on any props or state

  return (
    <div>
      <h1 className='header'>View Your Roster</h1>
      <div id="firebaseui-auth-container"></div>
    </div>
  );
};

export default Auth;



// import React, { useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';
// import './Auth.css';
// import firebase from 'firebase/compat/app';
// import 'firebase/compat/auth';
// import { firebaseConfig } from './firebase-config';
// import * as firebaseui from 'firebaseui';
// import 'firebaseui/dist/firebaseui.css';

// const FirebaseAuth = () => {
//     useEffect(() => {
//         let ui;
//         const uiConfig = {
//             // signInSuccessUrl: '/',
//             signInOptions: [
//                 {
//                 provider: firebase.auth.EmailAuthProvider.PROVIDER_ID,
//                 requireDisplayName: true,
//                 },
//                 firebase.auth.GoogleAuthProvider.PROVIDER_ID,
//                 // Add other sign-in providers as needed
//             ],
//         signInFailure: (error) => {
//             // Handle sign-in failures, e.g., when an existing user is asked to sign up
//             if (error.code === 'auth/account-exists-with-different-credential') {
//             // User already has an account with a different credential
//             // You can handle this case by showing a message or taking appropriate action
//             console.log('User already has an account with a different credential');
//             }
//         },
//     };

//     if (!firebaseui.auth.AuthUI.getInstance()) {
//       ui = new firebaseui.auth.AuthUI(firebase.auth());
//       ui.start('#firebaseui-auth-container', uiConfig);
//     }

//     return () => {
//       if (ui) {
//         ui.reset();
//       }
//     };
//   }, []);

//   const navigate = useNavigate();
//   useEffect(() => {
//     const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
//       if (user) {
//         navigate('/app');
//         // User is signed in, you can perform further actions here
//         console.log('User is signed in:', user);
//       } else {
//         navigate('/');
//         // User is signed out, you can handle the sign-out state here
//         console.log('User is signed out');
//       }
//     });

//     return () => {
//       unsubscribe();
//     };
//   }, []);

//   return <div id="firebaseui-auth-container"></div>;
// };

// function Auth() {
//   firebase.initializeApp(firebaseConfig);
//   return (
//     <div className="login-div">
//       <h1 className="header">View Your Roster</h1>
//       <FirebaseAuth />
//     </div>
//   );
// }

// export default Auth;