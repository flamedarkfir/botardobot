const firebaseConfig = {
    apiKey: "AIzaSyBWfU3-hBLuWBCwxs8MmcONZ37gy8BCDu8",
    authDomain: "botardo-bot.firebaseapp.com",
    databaseURL: "https://botardo-bot-default-rtdb.firebaseio.com",
    projectId: "botardo-bot",
    storageBucket: "botardo-bot.firebasestorage.app",
    messagingSenderId: "675230033465",
    appId: "1:675230033465:android:532fcceb5c134e16e80fe8"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

const elements = {
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    email: document.getElementById('email'),
    password: document.getElementById('password'),
    registerName: document.getElementById('registerName'),
    registerEmail: document.getElementById('registerEmail'),
    registerPassword: document.getElementById('registerPassword'),
    confirmPassword: document.getElementById('confirmPassword'),
    loginBtn: document.getElementById('loginBtn'),
    registerBtn: document.getElementById('registerBtn'),
    googleLoginBtn: document.getElementById('googleLoginBtn'),
    loginCard: document.querySelector('.login-card'),
    registerCard: document.getElementById('registerCard'),
    registerLink: document.getElementById('registerLink'),
    loginLink: document.getElementById('loginLink'),
    toast: document.getElementById('toast'),
    spaceBackground: document.getElementById('space-background')
};

function createStarfield() {
    const starCount = 100;
    const colors = ['#ffffff', '#f8f8ff', '#e6f7ff', '#fff8e6'];
    
    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        
        const size = Math.random() * 2 + 0.5;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const duration = Math.random() * 4 + 2;
        
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        star.style.backgroundColor = color;
        star.style.animationDuration = `${duration}s`;
        star.style.animationDelay = `${Math.random() * 5}s`;
        
        elements.spaceBackground.appendChild(star);
    }
}

function showToast(message, isSuccess = false) {
    elements.toast.textContent = message;
    elements.toast.className = `toast ${isSuccess ? 'success' : ''}`;
    elements.toast.classList.add('show');
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

function toggleForms() {
    elements.loginCard.classList.toggle('hidden');
    elements.registerCard.classList.toggle('hidden');
}

function setButtonLoading(button, isLoading) {
    const btnText = button.querySelector('.btn-text');
    const btnLoader = button.querySelector('.btn-loader');
    const btnIcon = button.querySelector('i');
    
    if (isLoading) {
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');
        if (btnIcon) btnIcon.classList.add('hidden');
        button.disabled = true;
        button.classList.add('loading');
    } else {
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
        if (btnIcon) btnIcon.classList.remove('hidden');
        button.disabled = false;
        button.classList.remove('loading');
    }
}

function saveUserData(userId, name, email) {
    const userData = {
        name: name,
        email: email,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        lastLogin: firebase.database.ServerValue.TIMESTAMP
    };
    
    return database.ref('users/' + userId).set(userData);
}

function updateUserLastLogin(userId) {
    return database.ref('users/' + userId + '/lastLogin').set(
        firebase.database.ServerValue.TIMESTAMP
    );
}

async function loginWithEmail(email, password) {
    try {
        setButtonLoading(elements.loginBtn, true);
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        
        await updateUserLastLogin(userCredential.user.uid);
        
        showToast('¡Inicio de sesión exitoso!', true);
        
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
    } catch (error) {
        let errorMessage = 'Error al iniciar sesión';
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No existe una cuenta con este correo';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Contraseña incorrecta';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Correo electrónico inválido';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Demasiados intentos fallidos. Intenta más tarde';
                break;
        }
        
        showToast(errorMessage);
    } finally {
        setButtonLoading(elements.loginBtn, false);
    }
}

async function registerWithEmail(name, email, password) {
    if (password !== elements.confirmPassword.value) {
        showToast('Las contraseñas no coinciden');
        return;
    }
    
    if (password.length < 6) {
        showToast('La contraseña debe tener al menos 6 caracteres');
        return;
    }
    
    try {
        setButtonLoading(elements.registerBtn, true);
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        
        await userCredential.user.updateProfile({
            displayName: name
        });
        
        await saveUserData(userCredential.user.uid, name, email);
        
        showToast('¡Cuenta creada exitosamente!', true);
        
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
    } catch (error) {
        let errorMessage = 'Error al crear la cuenta';
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'Este correo ya está en uso';
                break;
            case 'auth/weak-password':
                errorMessage = 'La contraseña es demasiado débil';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Correo electrónico inválido';
                break;
            case 'auth/operation-not-allowed':
                errorMessage = 'Operación no permitida';
                break;
        }
        
        showToast(errorMessage);
    } finally {
        setButtonLoading(elements.registerBtn, false);
    }
}

async function loginWithGoogle() {
    try {
        setButtonLoading(elements.googleLoginBtn, true);
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');
        const result = await auth.signInWithPopup(provider);
        
        if (result.additionalUserInfo.isNewUser) {
            await saveUserData(
                result.user.uid, 
                result.user.displayName, 
                result.user.email
            );
        } else {
            await updateUserLastLogin(result.user.uid);
        }
        
        showToast('¡Inicio de sesión con Google exitoso!', true);
        
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
    } catch (error) {
        let errorMessage = 'Error al iniciar sesión con Google';
        switch (error.code) {
            case 'auth/popup-closed-by-user':
                errorMessage = 'El popup de Google fue cerrado. Intenta de nuevo';
                break;
            case 'auth/popup-blocked':
                errorMessage = 'El popup fue bloqueado por el navegador. Habilita los popups e intenta de nuevo';
                break;
            case 'auth/auth-domain-config-required':
                errorMessage = 'Configuración de dominio no válida. Verifica la consola de Firebase';
                break;
        }
        
        showToast(errorMessage);
    } finally {
        setButtonLoading(elements.googleLoginBtn, false);
    }
}

function checkAuthState() {
    auth.onAuthStateChanged((user) => {
        if (user) {
            window.location.href = 'login.html';
        }
    });
}

function setupEventListeners() {
    elements.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        loginWithEmail(elements.email.value, elements.password.value);
    });
    
    elements.registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        registerWithEmail(
            elements.registerName.value, 
            elements.registerEmail.value, 
            elements.registerPassword.value
        );
    });
    
    elements.googleLoginBtn.addEventListener('click', loginWithGoogle);
    
    elements.registerLink.addEventListener('click', (e) => {
        e.preventDefault();
        toggleForms();
    });
    
    elements.loginLink.addEventListener('click', (e) => {
        e.preventDefault();
        toggleForms();
    });
}

function playBackgroundMusic() {
    const audio = new Audio('Musica/Index.mp3');
    audio.volume = 0.05; // Set very low volume (5%) for soft background music
    audio.loop = true; // Loop the music
    audio.play().catch(error => {
        console.error('Error playing audio on load:', error);
        // Fallback: Play music on first user interaction
        const playOnInteraction = () => {
            audio.play().catch(err => console.error('Error playing audio on interaction:', err));
            document.removeEventListener('click', playOnInteraction);
        };
        document.addEventListener('click', playOnInteraction);
    });
}

function init() {
    createStarfield();
    setupEventListeners();
    checkAuthState();
    playBackgroundMusic();
}

document.addEventListener('DOMContentLoaded', init);