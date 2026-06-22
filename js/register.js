// ─── POCKETBASE AUTH ───
const PB_URL = 'http://192.168.200.15:8090';

async function pbRequest(method, path, body) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${PB_URL}/api/${path}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `Error ${res.status}`);
    return data;
}

document.addEventListener('DOMContentLoaded', () => {

    const welcomeScreen = document.getElementById('auth-welcome-screen');
    const wonderScreen = document.getElementById('auth-wonder-screen');

    const btnShowWonder = document.getElementById('btn-show-wonder');
    const btnBackToWelcome = document.getElementById('btn-back-to-welcome');

    const wonderForm = document.getElementById('wonder-login-form');
    const linkForgotPassword = document.getElementById('link-forgot-password');
    const linkSignUp = document.getElementById('link-sign-up');

    // Google-knoppen verbergen (PocketBase OAuth vereist extra configuratie)
    const btnGoogleWelcome = document.getElementById('btn-google-welcome');
    const btnGoogleWonder = document.getElementById('btn-google-wonder');
    const separatorEl = document.querySelector('.separator');
    if (btnGoogleWelcome) btnGoogleWelcome.style.display = 'none';
    if (btnGoogleWonder) btnGoogleWonder.style.display = 'none';

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
        wonderForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const submitBtn = wonderForm.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Bezig...';
            submitBtn.disabled = true;

            try {
                const result = await pbRequest('POST', 'collections/users/auth-with-password', {
                    identity: email,
                    password: password
                });
                saveUserSession(result);
                window.location.href = 'pages/dashboard.html';
            } catch(error) {
                alert('Inloggen mislukt: ' + error.message);
                submitBtn.textContent = 'Sign In';
                submitBtn.disabled = false;
            }
        });
    }

    if (linkForgotPassword) {
        linkForgotPassword.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = prompt('Voer je e-mailadres in om je wachtwoord te herstellen:');
            if (!email) return;
            try {
                await pbRequest('POST', 'collections/users/request-password-reset', { email });
                alert('Wachtwoord-herstelmail verzonden! Controleer je inbox.');
            } catch(error) {
                alert('Fout: ' + error.message);
            }
        });
    }

    if (linkSignUp) {
        linkSignUp.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = prompt('Voer je nieuwe e-mailadres in:');
            const password = prompt('Kies een sterk wachtwoord (min. 8 tekens):');

            if (email && password) {
                try {
                    // Account aanmaken
                    await pbRequest('POST', 'collections/users/records', {
                        email,
                        password,
                        passwordConfirm: password,
                        name: email.split('@')[0]
                    });
                    // Direct inloggen
                    const result = await pbRequest('POST', 'collections/users/auth-with-password', {
                        identity: email,
                        password: password
                    });
                    alert('Account aangemaakt!');
                    saveUserSession(result);
                    window.location.href = 'pages/dashboard.html';
                } catch(error) {
                    alert('Registratie mislukt: ' + error.message);
                }
            }
        });
    }
});

function saveUserSession(authResult) {
    const record = authResult.record;
    let avatarVal = record.profilePicSelection;
    if (avatarVal && !avatarVal.startsWith('http') && !avatarVal.startsWith('data:') && !avatarVal.includes('.')) {
      avatarVal = record.avatar || '';
    } else if (!avatarVal) {
      avatarVal = record.avatar || '';
    }
    
    if (avatarVal && avatarVal.startsWith('data:')) {
        // Base64 image, skip
    } else if (avatarVal && !avatarVal.startsWith('http') && avatarVal.length > 5 && avatarVal.includes('.')) {
        // PocketBase file URL: /api/files/collectionIdOrName/recordId/filename
        avatarVal = `${PB_URL}/api/files/users/${record.id}/${avatarVal}?token=${authResult.token}`;
    }
    const userAccount = {
        isLoggedIn: true,
        wonderId: record.id,
        email: record.email,
        name: record.name || record.email?.split('@')[0] || 'Wonder Gebruiker',
        avatar: avatarVal,
        token: authResult.token,
        lastSync: new Date().getTime()
    };
    localStorage.setItem('wonderUser', JSON.stringify(userAccount));
}
