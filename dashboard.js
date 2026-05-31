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

document.addEventListener('DOMContentLoaded', () => {
    
    // Check of de mobiele gebruiker is ingelogd
    auth.onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = "../index.html";
        }
    });

    const navJournal = document.getElementById('nav-journal');
    const navInsights = document.getElementById('nav-insights');
    const navSettings = document.getElementById('nav-settings');
    const btnLogout = document.getElementById('btn-logout');

    const viewJournal = document.getElementById('view-journal');
    const viewInsights = document.getElementById('view-insights');
    const viewSettings = document.getElementById('view-settings');

    function switchView(activeButton, activeView) {
        const allButtons = document.querySelectorAll('.nav-item');
        const allViews = document.querySelectorAll('.app-view');

        allButtons.forEach(btn => btn.classList.remove('active'));
        allViews.forEach(view => view.classList.remove('active'));

        activeButton.classList.add('active');
        activeView.classList.add('active');
    }

    if (navJournal && viewJournal) {
        navJournal.addEventListener('click', () => switchView(navJournal, viewJournal));
    }

    if (navInsights && viewInsights) {
        navInsights.addEventListener('click', () => switchView(navInsights, viewInsights));
    }

    if (navSettings && viewSettings) {
        navSettings.addEventListener('click', () => switchView(navSettings, viewSettings));
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            const confirmLogout = confirm("Are you sure you want to log out?");
            if (confirmLogout) {
                auth.signOut()
                    .then(() => {
                        localStorage.removeItem('wonderUser');
                        window.location.href = "../index.html";
                    })
                    .catch((error) => {
                        alert("Error logging out: " + error.message);
                    });
            }
        });
    }
});
