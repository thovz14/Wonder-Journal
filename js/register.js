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
    const linkSignUp = document.getElementById('link-sign-up');
    
    // Nieuwe Signup elementen
    const signupScreen = document.getElementById('auth-signup-screen');
    const signupForm = document.getElementById('wonder-signup-form');
    const linkBackLogin = document.getElementById('link-back-login');
    const btnBackToWelcome2 = document.getElementById('btn-back-to-welcome2');
    const avatarInput = document.getElementById('signup-avatar');
    const avatarPreview = document.getElementById('signup-avatar-preview');

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

    if (linkSignUp) {
        linkSignUp.addEventListener('click', (e) => {
            e.preventDefault();
            wonderScreen.classList.remove('active');
            signupScreen.classList.add('active');
        });
    }

    if (linkBackLogin) {
        linkBackLogin.addEventListener('click', (e) => {
            e.preventDefault();
            signupScreen.classList.remove('active');
            wonderScreen.classList.add('active');
        });
    }

    if (btnBackToWelcome2) {
        btnBackToWelcome2.addEventListener('click', () => {
            signupScreen.classList.remove('active');
            welcomeScreen.classList.add('active');
        });
    }

    if (avatarInput && avatarPreview) {
        avatarInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const url = URL.createObjectURL(file);
                avatarPreview.style.backgroundImage = `url("${url}")`;
                avatarPreview.textContent = '';
            } else {
                avatarPreview.style.backgroundImage = 'none';
                avatarPreview.textContent = '📸';
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('signup-name').value.trim();
            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-password').value;
            const file = avatarInput.files[0];

            const submitBtn = signupForm.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Bezig...';
            submitBtn.disabled = true;

            try {
                // Maak FormData voor file upload
                const formData = new FormData();
                formData.append('email', email);
                formData.append('password', password);
                formData.append('passwordConfirm', password);
                formData.append('name', name);
                if (file) {
                    formData.append('avatar', file);
                }

                // Aanmaken
                const res = await fetch(`${PB_URL}/api/collections/users/records`, {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || 'Fout bij aanmaken account');

                // Direct inloggen
                const authResult = await pbRequest('POST', 'collections/users/auth-with-password', {
                    identity: email,
                    password: password
                });

                saveUserSession(authResult);
                window.location.href = 'pages/dashboard.html';

            } catch (error) {
                alert('Registratie mislukt: ' + error.message);
                submitBtn.textContent = 'Sign Up';
                submitBtn.disabled = false;
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
