const firebaseConfig = {
    apiKey: "AIzaSyBRpbQS2jN_Zp7XzKWYkM0Png4K4yzA9oc",
    authDomain: "familygames-3d0d2.firebaseapp.com",
    databaseURL: "https://familygames-3d0d2-default-rtdb.firebaseio.com",
    projectId: "familygames-3d0d2",
    storageBucket: "familygames-3d0d2.firebasestorage.app",
    messagingSenderId: "326491635543",
    appId: "1:326491635543:web:311ae892e5e3934cc20812",
    measurementId: "G-8PW38E5X5J"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

document.addEventListener('DOMContentLoaded', () => {
    
    // Check direct of de gebruiker terugkomt van de Google Redirect login flow
    auth.getRedirectResult()
        .then((result) => {
            if (result.user) {
                console.log("Successfully authenticated via Google Redirect:", result.user.email);
                saveUserSession(result.user);
                window.location.href = "dashboard/dashboard.html";
            }
        })
        .catch((error) => {
            console.error("Google redirect authentication failed:", error.message);
            alert("Google Sign-In failed: " + error.message);
        });

    const welcomeScreen = document.getElementById('auth-welcome-screen');
    const wonderScreen = document.getElementById('auth-wonder-screen');

    const btnShowWonder = document.getElementById('btn-show-wonder');
    const btnBackToWelcome = document.getElementById('btn-back-to-welcome');

    const wonderForm = document.getElementById('wonder-login-form');
    const btnGoogleWelcome = document.getElementById('btn-google-welcome');
    const btnGoogleWonder = document.getElementById('btn-google-wonder');
    const linkForgotPassword = document.getElementById('link-forgot-password');
    const linkSignUp = document.getElementById('link-sign-up');

    if (btnShowWonder) {
        btnShowWonder.addEventListener('click', () => {
            welcomeScreen.classList.remove('active');
            wonderScreen.classList.add('active');
        });
    }

    if (btnBackToWelcome) {
        btnBackToWelcome.addEventListener('click', () => {
            wonderScreen.classList.remove('active');
            welcomeScreen.classList.add('active');
        });
    }

    if (wonderForm) {
        wonderForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            auth.signInWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    saveUserSession(userCredential.user);
                    window.location.href = "dashboard/dashboard.html";
                })
                .catch((error) => {
                    alert("Login failed: " + error.message);
                });
        });
    }

    // Geoptimaliseerde mobiele redirect in plaats van pop-up
    const handleGoogleSignIn = () => {
        auth.signInWithRedirect(googleProvider);
    };

    if (btnGoogleWelcome) btnGoogleWelcome.addEventListener('click', handleGoogleSignIn);
    if (btnGoogleWonder) btnGoogleWonder.addEventListener('click', handleGoogleSignIn);

    if (linkForgotPassword) {
        linkForgotPassword.addEventListener('click', (e) => {
            e.preventDefault();
            const email = prompt("Please enter your email address to reset your password:");
            if (!email) return;

            auth.sendPasswordResetEmail(email)
                .then(() => {
                    alert("Password reset email sent!");
                })
                .catch((error) => {
                    alert("Error: " + error.message);
                });
        });
    }

    if (linkSignUp) {
        linkSignUp.addEventListener('click', (e) => {
            e.preventDefault();
            const email = prompt("Enter your new Wonder ID email:");
            const password = prompt("Enter a strong password:");
            
            if (email && password) {
                auth.createUserWithEmailAndPassword(email, password)
                    .then((userCredential) => {
                        alert("Account created successfully!");
                        saveUserSession(userCredential.user);
                        window.location.href = "dashboard/dashboard.html";
                    })
                    .catch((error) => {
                        alert("Registration failed: " + error.message);
                    });
            }
        });
    }
});

function saveUserSession(user) {
    const userAccount = {
        isLoggedIn: true,
        wonderId: user.uid,
        email: user.email,
        lastSync: new Date().getTime()
    };
    localStorage.setItem('wonderUser', JSON.stringify(userAccount));
}
