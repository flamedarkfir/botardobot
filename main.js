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

const DEFAULT_API_KEY = "AIzaSyDivHqC-ub6R5_scfi_Y4CkJNmW2Hz8rag";
let apiKey = localStorage.getItem('geminiApiKey') || DEFAULT_API_KEY;
let currentChat = null;
let chats = [];
let isProVersion = apiKey !== DEFAULT_API_KEY;
let currentUser = null;
let globalMessagesListener = null;
let isGlobalChat = false;
let selectedImage = null;

const domElements = {
    welcomeScreen: document.getElementById('welcomeScreen'),
    chatArea: document.getElementById('chatArea'),
    chatHistory: document.getElementById('chatHistory'),
    messagesContainer: document.getElementById('messagesContainer'),
    messageInput: document.getElementById('messageInput'),
    sendButton: document.getElementById('sendButton'),
    newChatBtn: document.getElementById('newChatBtn'),
    backBtn: document.querySelector('.back-btn'),
    currentSubject: document.getElementById('currentSubject'),
    workshopModal: document.getElementById('workshopModal'),
    apiKeyModal: document.getElementById('apiKeyModal'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    saveApiKeyBtn: document.getElementById('saveApiKey'),
    configBtn: document.getElementById('configBtn'),
    deleteChatBtn: document.getElementById('deleteChatBtn'),
    pdfToggleBtn: document.getElementById('pdfToggleBtn'),
    spaceBackground: document.getElementById('space-background'),
    userAvatar: document.getElementById('userAvatar'),
    userName: document.getElementById('userName'),
    logoutBtn: document.getElementById('logoutBtn'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    pdfViewerModal: document.getElementById('pdfViewerModal'),
    pdfSubject: document.getElementById('pdfSubject'),
    pdfCanvas: document.getElementById('pdfCanvas'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    pageInfo: document.getElementById('pageInfo'),
    imageInput: document.getElementById('imageInput'),
    imageUploadBtn: document.getElementById('imageUploadBtn'),
    imagePreviewContainer: document.getElementById('imagePreviewContainer'),
    imageModal: document.getElementById('imageModal'),
    imageModalContent: document.getElementById('imageModalContent'),
    imageModalClose: document.getElementById('imageModalClose')
};

let pdfDoc = null;
let currentPage = 1;
let totalPages = 1;

function createStarfield() {
    domElements.spaceBackground.innerHTML = '';
    const starCount = 150;
    const colors = ['#ffffff', '#f8f8ff', '#e6f7ff', '#fff8e6'];
    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        const size = Math.random() * 2.5 + 0.5;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const duration = Math.random() * 4 + 2;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        star.style.backgroundColor = color;
        star.style.animationDuration = `${duration}s`;
        star.style.animationDelay = `${Math.random() * 5}s`;
        star.style.opacity = document.body.classList.contains('dark-theme') ? '0.8' : '0.6';
        domElements.spaceBackground.appendChild(star);
    }
}

function parseMarkdown(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
}

function updateUserProfile(user) {
    if (user) {
        const displayName = user.displayName || user.email.split('@')[0];
        domElements.userName.textContent = displayName;
        if (user.photoURL) {
            const img = new Image();
            img.src = user.photoURL;
            img.onload = () => {
                domElements.userAvatar.style.backgroundImage = `url(${user.photoURL})`;
                domElements.userAvatar.style.backgroundSize = 'cover';
                domElements.userAvatar.style.backgroundPosition = 'center';
                domElements.userAvatar.textContent = '';
            };
            img.onerror = () => {
                const initials = displayName.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
                domElements.userAvatar.style.backgroundImage = 'none';
                domElements.userAvatar.textContent = initials;
                domElements.userAvatar.style.backgroundColor = 'var(--primary)';
            };
        } else {
            const initials = displayName.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
            domElements.userAvatar.style.backgroundImage = 'none';
            domElements.userAvatar.textContent = initials;
            domElements.userAvatar.style.backgroundColor = 'var(--primary)';
        }
    } else {
        domElements.userName.textContent = 'No autenticado';
        domElements.userAvatar.style.backgroundImage = 'none';
        domElements.userAvatar.textContent = 'NA';
        domElements.userAvatar.style.backgroundColor = 'var(--primary)';
    }
}

function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 50);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function setButtonLoading(button, isLoading) {
    const btnText = button.querySelector('.btn-text');
    const btnIcon = button.querySelector('i');
    const btnLoader = button.querySelector('.btn-loader');
    if (isLoading) {
        btnText.classList.add('hidden');
        btnIcon.classList.add('hidden');
        btnLoader.classList.remove('hidden');
        button.disabled = true;
        button.classList.add('loading');
    } else {
        btnText.classList.remove('hidden');
        btnIcon.classList.remove('hidden');
        btnLoader.classList.add('hidden');
        button.disabled = false;
        button.classList.remove('loading');
    }
}

async function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-theme');
    const themeIcon = domElements.themeToggleBtn.querySelector('i');
    themeIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    createStarfield();
    if (currentUser) {
        try {
            await database.ref(`users/${currentUser.uid}/settings/theme`).set(isDark ? 'dark' : 'light');
        } catch (error) {
            showToast('Error al guardar preferencia de tema', true);
        }
    }
}

async function applyStoredTheme() {
    if (!currentUser) return;
    try {
        const snapshot = await database.ref(`users/${currentUser.uid}/settings/theme`).once('value');
        const theme = snapshot.val();
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
            domElements.themeToggleBtn.querySelector('i').className = 'fas fa-sun';
        } else {
            document.body.classList.remove('dark-theme');
            domElements.themeToggleBtn.querySelector('i').className = 'fas fa-moon';
        }
        createStarfield();
    } catch (error) {}
}

function checkAuthState() {
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            updateUserProfile(user);
            loadChatsFromDatabase();
            applyStoredTheme();
        } else {
            currentUser = null;
            updateUserProfile(null);
            window.location.href = 'index.html';
        }
    });
}

async function loadChatsFromDatabase() {
    if (!currentUser) return;
    try {
        const snapshot = await database.ref(`users/${currentUser.uid}/chats`).once('value');
        chats = snapshot.val() ? Object.values(snapshot.val()) : [];
        renderChatHistory();
    } catch (error) {
        showToast('Error al cargar los chats', true);
    }
}

function renderChatHistory() {
    domElements.chatHistory.innerHTML = '';
    chats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.innerHTML = `
            <i class="fas fa-comment-alt"></i>
            <span>${chat.subject}</span>
            <button class="delete-chat-history-btn" data-id="${chat.id}" title="Borrar chat">
                <i class="fas fa-trash"></i>
            </button>
        `;
        chatItem.addEventListener('click', (e) => {
            if (!e.target.closest('.delete-chat-history-btn')) {
                loadChat(chat.id);
            }
        });
        domElements.chatHistory.appendChild(chatItem);
    });
    document.querySelectorAll('.delete-chat-history-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteChat(parseInt(btn.dataset.id));
        });
    });
}

async function deleteChat(chatId) {
    if (confirm('¿Estás seguro de borrar este chat? No podrás recuperarlo.')) {
        try {
            await database.ref(`users/${currentUser.uid}/chats/${chatId}`).remove();
            chats = chats.filter(chat => chat.id !== chatId);
            if (currentChat && currentChat.id === chatId) {
                stopListeningToGlobalMessages();
                domElements.welcomeScreen.classList.remove('hidden');
                domElements.chatArea.classList.add('hidden');
                domElements.pdfViewerModal.classList.add('hidden');
            }
            renderChatHistory();
            showToast('Chat borrado');
        } catch (error) {
            showToast('Error al borrar el chat', true);
        }
    }
}

async function createNewChat(subject) {
    if (!currentUser) {
        showToast('Debes estar autenticado para crear un chat', true);
        return;
    }

    stopListeningToGlobalMessages();
    
    if (subject === 'BuzzApp') {
        isGlobalChat = true;
        currentChat = {
            id: 'global-buzzapp',
            subject: 'BuzzApp',
            messages: [],
            isGlobal: true
        };
        domElements.currentSubject.textContent = 'BuzzApp - Chat Global';
        domElements.welcomeScreen.classList.add('hidden');
        domElements.chatArea.classList.remove('hidden');
        domElements.pdfToggleBtn.style.display = 'none';
        domElements.deleteChatBtn.style.display = 'none';
        domElements.imageUploadBtn.classList.add('hidden');
        
        loadGlobalMessages();
        return;
    }

    isGlobalChat = false;
    domElements.pdfToggleBtn.style.display = 'block';
    domElements.deleteChatBtn.style.display = 'block';
    domElements.imageUploadBtn.classList.remove('hidden');

    const newChat = {
        id: Date.now(),
        subject: subject,
        messages: [],
        createdAt: new Date().toISOString(),
        isGlobal: false
    };
    try {
        await database.ref(`users/${currentUser.uid}/chats/${newChat.id}`).set(newChat);
        chats.unshift(newChat);
        currentChat = newChat;
        domElements.currentSubject.textContent = subject;
        renderChatHistory();
        renderMessages();
        domElements.welcomeScreen.classList.add('hidden');
        domElements.chatArea.classList.remove('hidden');
    } catch (error) {
        showToast('Error al crear el chat', true);
    }
}

function loadChat(chatId) {
    stopListeningToGlobalMessages();
    currentChat = chats.find(chat => chat.id === chatId);
    if (currentChat) {
        isGlobalChat = false;
        domElements.currentSubject.textContent = currentChat.subject;
        domElements.welcomeScreen.classList.add('hidden');
        domElements.chatArea.classList.remove('hidden');
        domElements.pdfToggleBtn.style.display = 'block';
        domElements.deleteChatBtn.style.display = 'block';
        domElements.imageUploadBtn.classList.remove('hidden');
        renderMessages();
    }
}

function loadGlobalMessages() {
    domElements.messagesContainer.innerHTML = '';
    
    const noticeDiv = document.createElement('div');
    noticeDiv.className = 'global-chat-notice';
    noticeDiv.innerHTML = `
        <i class="fas fa-users"></i>
        <strong>Chat Global de BuzzApp</strong>
        <p style="margin-top:5px;font-size:0.9em;">Tus mensajes serán visibles para todos los usuarios.</p>
    `;
    domElements.messagesContainer.appendChild(noticeDiv);

    const messagesRef = database.ref('globalMessages/buzzapp');
    globalMessagesListener = messagesRef.orderByChild('timestamp').limitToLast(50);
    
    globalMessagesListener.on('child_added', (snapshot) => {
        const message = snapshot.val();
        const messageId = snapshot.key;
        addGlobalMessageToUI(message, messageId);
    });

    scrollToBottom();
}

function stopListeningToGlobalMessages() {
    if (globalMessagesListener) {
        globalMessagesListener.off();
        globalMessagesListener = null;
    }
    isGlobalChat = false;
}

async function toggleReaction(messageId, emoji) {
    if (!currentUser || !messageId) return;
    
    const reactionRef = database.ref(`globalMessages/buzzapp/${messageId}/reactions/${emoji}/${currentUser.uid}`);
    const snapshot = await reactionRef.once('value');
    
    if (snapshot.exists()) {
        await reactionRef.remove();
    } else {
        await reactionRef.set({
            userName: currentUser.displayName || currentUser.email.split('@')[0],
            timestamp: Date.now()
        });
    }
}

function addGlobalMessageToUI(message, messageId) {
    const isOwnMessage = currentUser && message.userId === currentUser.uid;
    const messageDiv = document.createElement('div');
    messageDiv.className = `global-message ${isOwnMessage ? 'own-message' : ''}`;
    messageDiv.dataset.messageId = messageId;
    
    const time = new Date(message.timestamp);
    const timeString = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const initials = message.userName.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
    
    let reactionsHTML = '';
    if (message.reactions) {
        const reactionCounts = {};
        const userReactions = new Set();
        
        Object.keys(message.reactions).forEach(emoji => {
            const users = message.reactions[emoji];
            reactionCounts[emoji] = Object.keys(users).length;
            if (currentUser && users[currentUser.uid]) {
                userReactions.add(emoji);
            }
        });
        
        const reactionsArray = Object.entries(reactionCounts).map(([emoji, count]) => {
            const reacted = userReactions.has(emoji);
            return `<span class="reaction ${reacted ? 'reacted' : ''}" onclick="event.stopPropagation(); window.toggleReaction('${messageId}', '${emoji}')">${emoji} ${count}</span>`;
        });
        
        if (reactionsArray.length > 0) {
            reactionsHTML = `<div class="global-message-reactions">${reactionsArray.join('')}</div>`;
        }
    }
    
    messageDiv.innerHTML = `
        <div class="global-message-avatar">${initials}</div>
        <div class="global-message-bubble">
            <div class="global-message-header">
                <span class="global-message-user">${message.userName}</span>
                <span class="global-message-time">${timeString}</span>
            </div>
            <div class="global-message-content">${parseMarkdown(message.text)}</div>
            ${reactionsHTML}
            <button class="add-reaction-btn" onclick="event.stopPropagation(); window.showReactionPicker('${messageId}', this)">😊</button>
        </div>
    `;
    
    domElements.messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

window.toggleReaction = toggleReaction;

window.showReactionPicker = function(messageId, button) {
    const existingPicker = document.querySelector('.reaction-picker');
    if (existingPicker) {
        existingPicker.remove();
        return;
    }
    
    const picker = document.createElement('div');
    picker.className = 'reaction-picker';
    picker.innerHTML = `
        <span onclick="event.stopPropagation(); window.toggleReaction('${messageId}', '❤️'); this.parentElement.remove()">❤️</span>
        <span onclick="event.stopPropagation(); window.toggleReaction('${messageId}', '👍'); this.parentElement.remove()">👍</span>
        <span onclick="event.stopPropagation(); window.toggleReaction('${messageId}', '😂'); this.parentElement.remove()">😂</span>
        <span onclick="event.stopPropagation(); window.toggleReaction('${messageId}', '😮'); this.parentElement.remove()">😮</span>
        <span onclick="event.stopPropagation(); window.toggleReaction('${messageId}', '🔥'); this.parentElement.remove()">🔥</span>
        <span onclick="event.stopPropagation(); window.toggleReaction('${messageId}', '🎉'); this.parentElement.remove()">🎉</span>
    `;
    
    button.parentElement.style.position = 'relative';
    button.parentElement.appendChild(picker);
    
    setTimeout(() => {
        const closePickerOnClick = (e) => {
            if (!picker.contains(e.target) && e.target !== button) {
                picker.remove();
                document.removeEventListener('click', closePickerOnClick);
            }
        };
        document.addEventListener('click', closePickerOnClick);
    }, 100);
};

function getAIReaction(userMessage) {
    const lowerMessage = userMessage.toLowerCase();
    
    const positiveWords = ['gracias', 'genial', 'excelente', 'increíble', 'perfecto', 'maravilloso', 'fantástico', 'bueno', 'buena', 'hermoso', 'eres el mejor', 'me ayudaste', 'te quiero', 'te amo', 'amo'];
    const excitedWords = ['wow', 'guau', 'increíble', 'asombroso', 'sorprendente'];
    const funnyWords = ['jaja', 'jajaja', 'jajajaja', 'jeje', 'jejeje', 'jijiji', 'lol', 'risa', 'gracioso', 'chistoso', 'jjj', 'jaj'];
    const sadWords = ['triste', 'mal', 'difícil', 'no entiendo', 'complicado', 'ayuda'];
    const celebrationWords = ['logré', 'aprobé', 'gané', 'conseguí', 'éxito', 'victoria'];
    
    if (funnyWords.some(word => lowerMessage.includes(word))) {
        return '😂';
    }
    if (positiveWords.some(word => lowerMessage.includes(word))) {
        return '❤️';
    }
    if (excitedWords.some(word => lowerMessage.includes(word))) {
        return '😮';
    }
    if (sadWords.some(word => lowerMessage.includes(word))) {
        return '🤗';
    }
    if (celebrationWords.some(word => lowerMessage.includes(word))) {
        return '🎉';
    }
    
    return null;
}

function renderMessages() {
    domElements.messagesContainer.innerHTML = '';
    if (currentChat?.messages?.length > 0) {
        currentChat.messages.forEach(msg => {
            addMessageToUI(msg.sender, msg.text, msg.timestamp, msg.imageUrl);
        });
    } else {
        const welcomeMessages = {
            "Matemáticas": "¡Hola! Soy tu asistente de Matemáticas. ¿En qué problema necesitas ayuda hoy? Puedo explicarte desde álgebra básica hasta cálculo avanzado.",
            "Lenguaje": "¡Hola! Soy tu asistente de Lenguaje. ¿Necesitas ayuda con gramática, redacción o análisis literario? Estoy aquí para ayudarte.",
            "Taller de Sistemas": "¡Hola! Soy tu experto en Sistemas. ¿Tienes dudas sobre programación, redes o hardware? Pregúntame lo que necesites.",
            "Sociales": "¡Hola! Soy tu guía en Ciencias Sociales. ¿Historia, geografía o civismo? Estoy aquí para ayudarte a entender estos temas.",
            "Biología": "¡Hola! Soy tu asistente de Biología. Desde células hasta ecosistemas, puedo explicarte cualquier concepto biológico.",
            "Física": "¡Hola! Soy tu asistente de Física. ¿Leyes de Newton, termodinámica o física cuántica? Pregúntame lo que necesites.",
            "Química": "¡Hola! Soy tu experto en Química. ¿Tabla periódica, reacciones químicas o química orgánica? Estoy aquí para ayudarte.",
            "Libre": "¡Hola! ¿En qué puedo ayudarte hoy? Puedes preguntarme sobre cualquier tema y haré mi mejor esfuerzo por ayudarte."
        };
        const defaultMessage = "¡Hola! Soy BotardoBot, tu asistente educativo. ¿En qué puedo ayudarte hoy?";
        const welcomeMsg = welcomeMessages[currentChat.subject] || defaultMessage;
        addMessageToUI('bot', welcomeMsg);
        currentChat.messages.push({
            sender: 'bot',
            text: welcomeMsg,
            timestamp: new Date().toISOString()
        });
        saveChats();
    }
}

function addMessageToUI(sender, text, timestamp = null, imageUrl = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    const time = timestamp ? new Date(timestamp) : new Date();
    const timeString = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let imageHTML = '';
    if (imageUrl) {
        imageHTML = `<img src="${imageUrl}" class="message-image" alt="Imagen enviada" onclick="openImageModal('${imageUrl}')">`;
    }
    
    // Para mensajes del bot, buscar reacciones en el texto
    let displayText = text;
    let reactionsHTML = '';
    if (sender === 'bot' && text.includes('<span class="bot-message-reactions">')) {
        const parts = text.split('<span class="bot-message-reactions">');
        displayText = parts[0];
        const reaction = parts[1].split('</span>')[0];
        reactionsHTML = `<span class="bot-message-reactions">${reaction}</span>`;
    }
    
    messageDiv.innerHTML = `
        ${reactionsHTML}
        ${imageHTML}
        <div class="message-content">${parseMarkdown(displayText)}</div>
        <div class="message-time">${timeString}</div>
    `;
    domElements.messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function openImageModal(imageUrl) {
    domElements.imageModalContent.src = imageUrl;
    domElements.imageModal.classList.add('active');
}

function closeImageModal() {
    domElements.imageModal.classList.remove('active');
}

function handleImageSelect(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        if (file.size > 5 * 1024 * 1024) {
            showToast('La imagen es muy grande. Máximo 5MB', true);
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            selectedImage = e.target.result;
            showImagePreview(selectedImage);
        };
        reader.readAsDataURL(file);
    }
}

function showImagePreview(imageData) {
    domElements.imagePreviewContainer.innerHTML = `
        <img src="${imageData}" class="image-preview" alt="Vista previa">
        <button class="remove-image-btn" onclick="removeImagePreview()">
            <i class="fas fa-times"></i>
        </button>
    `;
    domElements.imagePreviewContainer.classList.remove('hidden');
}

function removeImagePreview() {
    selectedImage = null;
    domElements.imagePreviewContainer.innerHTML = '';
    domElements.imagePreviewContainer.classList.add('hidden');
    domElements.imageInput.value = '';
}

async function extractTextFromPDF(pdfUrl) {
    try {
        const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(' ') + '\n';
        }
        return text.trim();
    } catch (error) {
        return '';
    }
}

async function getPDFContent(subject) {
    let pdfName = subject;
    if (subject.startsWith('Taller de ')) {
        pdfName = subject.replace('Taller de ', '');
    }
    const pdfUrl = `PDF/${encodeURIComponent(pdfName)}.pdf`;
    try {
        const response = await fetch(pdfUrl);
        if (!response.ok) return '';
        const arrayBuffer = await response.arrayBuffer();
        const pdfText = await extractTextFromPDF({ data: arrayBuffer });
        return pdfText;
    } catch (error) {
        return '';
    }
}

async function analyzeImageWithGemini(imageData, prompt) {
    if (!apiKey) throw new Error('API Key no configurada');
    
    const base64Image = imageData.split(',')[1];
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
    
    const fullPrompt = `${prompt}\n\nIMPORTANTE: Responde ÚNICAMENTE en español. Toda tu respuesta debe estar en español.`;
    
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: fullPrompt },
                        {
                            inline_data: {
                                mime_type: "image/jpeg",
                                data: base64Image
                            }
                        }
                    ]
                }]
            })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Error en la API');
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        throw new Error('Error al analizar la imagen: ' + error.message);
    }
}

async function callGeminiAPI(prompt, imageData = null) {
    if (!apiKey) throw new Error('API Key no configurada');
    
    if (imageData) {
        return await analyzeImageWithGemini(imageData, prompt);
    }
    
    const model = isProVersion ? 'gemini-pro' : 'gemini-2.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const conversationContext = currentChat.messages.slice(-6).map(msg => {
        return `${msg.sender === 'user' ? 'Usuario' : 'Asistente'}: ${msg.text}`;
    }).join('\n\n');
    const pdfContent = await getPDFContent(currentChat.subject);
    const context = `Eres "BotardoBot", un asistente educativo especializado en ${currentChat.subject} con un tono amigable y empático. 

    Instrucciones clave:
    1. DEBES responder SIEMPRE en español, sin excepción
    2. Mantén un tono cálido y alentador, como un tutor paciente
    3. Si la pregunta no es de tu especialidad, sugiere amablemente cómo podrías ayudar dentro de tu área
    4. Usa ejemplos prácticos cuando sea posible
    5. Reconoce el esfuerzo del usuario
    6. Mantén respuestas claras pero detalladas
    7. Usa **negritas** para conceptos clave y *cursivas* para énfasis
    8. Recuerda el historial de conversación anterior para mantener continuidad
    9. No repetir Hola demasiadas veces para hacer entender al usuario que sigues activa en la conversación
    10. No hacer textos largos, responde directo al grano y en español
    11. Usa el contenido del PDF proporcionado para dar respuestas contextuales, como si el usuario ya hubiera compartido esa información, pero sin mencionar explícitamente el PDF

    Contenido del material de estudio (PDF de ${currentChat.subject}):
    ${pdfContent ? pdfContent.slice(0, 5000) : 'No hay material de estudio disponible.'}

    Contexto de la conversación:
    ${conversationContext}

    Nueva pregunta del usuario: ${prompt}

    IMPORTANTE: Tu respuesta DEBE estar completamente en español.

    (Responde como un experto en ${currentChat.subject} con actitud positiva y motivadora)`;
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: context }] }]
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Error en la API');
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        throw new Error('Parece que hubo un problema al procesar tu pregunta. ¿Podrías intentarlo de nuevo?');
    }
}

async function sendMessage() {
    const text = domElements.messageInput.value.trim();
    if ((!text && !selectedImage) || !currentUser) {
        if (!currentUser) showToast('Debes estar autenticado para enviar mensajes', true);
        return;
    }

    if (isGlobalChat) {
        await sendGlobalMessage(text);
        domElements.messageInput.value = '';
        adjustTextareaHeight();
        return;
    }

    if (!currentChat) return;

    const messageData = {
        sender: 'user',
        text: text || '📷 Imagen',
        timestamp: new Date().toISOString()
    };
    
    if (selectedImage) {
        messageData.imageUrl = selectedImage;
    }

    currentChat.messages.push(messageData);
    addMessageToUI('user', text || '📷 Imagen', null, selectedImage);
    
    const imageToSend = selectedImage;
    const userText = text;
    domElements.messageInput.value = '';
    removeImagePreview();
    adjustTextareaHeight();
    
    const typingIndicator = showTypingIndicator();
    try {
        const response = await callGeminiAPI(userText || 'Describe lo que ves en esta imagen y ayúdame con ello', imageToSend);
        typingIndicator.remove();
        
        const aiReaction = getAIReaction(userText);
        let botResponse = response;
        if (aiReaction) {
            botResponse += `<span class="bot-message-reactions">${aiReaction}</span>`;
        }
        
        currentChat.messages.push({
            sender: 'bot',
            text: response,
            timestamp: new Date().toISOString()
        });
        addMessageToUI('bot', botResponse);
        await saveChats();
    } catch (error) {
        typingIndicator.remove();
        addMessageToUI('bot', `${error.message}`);
    }
}

async function sendGlobalMessage(text) {
    if (!currentUser || !text.trim()) return;
    
    try {
        const displayName = currentUser.displayName || currentUser.email.split('@')[0];
        const messageData = {
            userId: currentUser.uid,
            userName: displayName,
            text: text,
            timestamp: Date.now()
        };
        
        await database.ref('globalMessages/buzzapp').push(messageData);
        showToast('Mensaje enviado');
    } catch (error) {
        showToast('Error al enviar mensaje', true);
    }
}

function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot-message typing-indicator';
    typingDiv.innerHTML = `
        <div class="message-content">
            <div class="typing-dots">
                <div></div><div></div><div></div>
            </div>
        </div>
    `;
    domElements.messagesContainer.appendChild(typingDiv);
    scrollToBottom();
    return typingDiv;
}

function scrollToBottom() {
    domElements.messagesContainer.scrollTop = domElements.messagesContainer.scrollHeight;
}

function adjustTextareaHeight() {
    domElements.messageInput.style.height = 'auto';
    domElements.messageInput.style.height = `${domElements.messageInput.scrollHeight}px`;
}

async function saveChats() {
    if (!currentUser || !currentChat || isGlobalChat) return;
    try {
        await database.ref(`users/${currentUser.uid}/chats/${currentChat.id}`).set(currentChat);
    } catch (error) {
        showToast('Error al guardar el chat', true);
    }
}

function playBackgroundMusic() {
    const audio = new Audio('Musica/Login.mp3');
    audio.volume = 0.05;
    audio.loop = true;
    audio.play().catch(error => {
        const playOnInteraction = () => {
            audio.play().catch(err => {});
            document.removeEventListener('click', playOnInteraction);
        };
        document.addEventListener('click', playOnInteraction);
    });
}

async function renderPDFPage(pageNum) {
    if (!pdfDoc) return;
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = domElements.pdfCanvas;
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise;
    domElements.pageInfo.textContent = `Página ${pageNum} de ${totalPages}`;
    domElements.prevPageBtn.disabled = pageNum === 1;
    domElements.nextPageBtn.disabled = pageNum === totalPages;
}

async function showPDF(subject) {
    let pdfName = subject;
    if (subject.startsWith('Taller de ')) {
        pdfName = subject.replace('Taller de ', '');
    }
    const pdfUrl = `PDF/${encodeURIComponent(pdfName)}.pdf`;
    try {
        const response = await fetch(pdfUrl);
        if (!response.ok) {
            domElements.pdfViewerModal.classList.add('hidden');
            return;
        }
        const arrayBuffer = await response.arrayBuffer();
        pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        totalPages = pdfDoc.numPages;
        currentPage = 1;
        domElements.pdfSubject.textContent = subject;
        domElements.pdfViewerModal.classList.remove('hidden');
        await renderPDFPage(currentPage);
        domElements.pdfCanvas.style.cursor = 'pointer';
        domElements.pdfCanvas.addEventListener('click', () => {
            window.open(pdfUrl, '_blank');
        });
        const openPdfBtn = document.getElementById('openPdfBtn');
        openPdfBtn.addEventListener('click', () => {
            window.open(pdfUrl, '_blank');
        });
    } catch (error) {
        domElements.pdfViewerModal.classList.add('hidden');
        showToast('No se pudo cargar el PDF', true);
    }
}

function setupPDFEventListeners() {
    domElements.prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderPDFPage(currentPage);
        }
    });
    domElements.nextPageBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderPDFPage(currentPage);
        }
    });
    domElements.pdfViewerModal.querySelector('.close-modal').addEventListener('click', () => {
        domElements.pdfViewerModal.classList.add('hidden');
        pdfDoc = null;
        currentPage = 1;
        totalPages = 1;
    });
    domElements.pdfViewerModal.addEventListener('click', (e) => {
        if (e.target === domElements.pdfViewerModal) {
            domElements.pdfViewerModal.classList.add('hidden');
            pdfDoc = null;
            currentPage = 1;
            totalPages = 1;
        }
    });
}

function setupEventListeners() {
    domElements.sendButton.addEventListener('click', sendMessage);
    domElements.backBtn.addEventListener('click', () => {
        stopListeningToGlobalMessages();
        domElements.welcomeScreen.classList.remove('hidden');
        domElements.chatArea.classList.add('hidden');
        domElements.pdfViewerModal.classList.add('hidden');
    });
    domElements.newChatBtn.addEventListener('click', () => {
        stopListeningToGlobalMessages();
        domElements.welcomeScreen.classList.remove('hidden');
        domElements.chatArea.classList.add('hidden');
        domElements.pdfViewerModal.classList.add('hidden');
    });
    domElements.deleteChatBtn.addEventListener('click', () => {
        if (currentChat && !isGlobalChat) deleteChat(currentChat.id);
    });
    domElements.pdfToggleBtn.addEventListener('click', () => {
        if (domElements.pdfViewerModal.classList.contains('hidden')) {
            showPDF(currentChat.subject);
        } else {
            domElements.pdfViewerModal.classList.add('hidden');
            pdfDoc = null;
            currentPage = 1;
            totalPages = 1;
        }
    });

    domElements.imageUploadBtn.addEventListener('click', () => {
        domElements.imageInput.click();
    });

    domElements.imageInput.addEventListener('change', handleImageSelect);

    domElements.imageModalClose.addEventListener('click', closeImageModal);
    domElements.imageModal.addEventListener('click', (e) => {
        if (e.target === domElements.imageModal) {
            closeImageModal();
        }
    });

    window.openImageModal = openImageModal;
    window.removeImagePreview = removeImagePreview;

    const buzzCard = document.querySelector('[data-subject="BuzzApp"]');
    if (buzzCard) {
        buzzCard.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!localStorage.getItem('buzzTermsAccepted')) {
                document.getElementById('buzzTermsModal').classList.remove('hidden');
            } else {
                createNewChat('BuzzApp');
            }
        });
    }

    document.querySelectorAll('.subject-card').forEach(card => {
        if (card.dataset.subject !== 'BuzzApp') {
            card.addEventListener('click', () => {
                const subject = card.dataset.subject;
                subject === "Taller" 
                    ? domElements.workshopModal.classList.remove('hidden')
                    : createNewChat(subject);
            });
        }
    });

    document.getElementById('acceptBuzzTerms')?.addEventListener('click', () => {
        localStorage.setItem('buzzTermsAccepted', 'true');
        document.getElementById('buzzTermsModal').classList.add('hidden');
        createNewChat('BuzzApp');
    });

    document.getElementById('declineBuzzTerms')?.addEventListener('click', () => {
        document.getElementById('buzzTermsModal').classList.add('hidden');
    });

    document.querySelectorAll('.workshop-option').forEach(option => {
        option.addEventListener('click', () => {
            createNewChat(`Taller de ${option.dataset.workshop}`);
            domElements.workshopModal.classList.add('hidden');
        });
    });

    domElements.configBtn.addEventListener('click', () => {
        domElements.apiKeyModal.classList.remove('hidden');
        domElements.apiKeyInput.value = apiKey;
    });

    domElements.saveApiKeyBtn.addEventListener('click', () => {
        const newKey = domElements.apiKeyInput.value.trim();
        apiKey = newKey && newKey !== DEFAULT_API_KEY ? newKey : DEFAULT_API_KEY;
        isProVersion = apiKey !== DEFAULT_API_KEY;
        if (isProVersion) {
            localStorage.setItem('geminiApiKey', apiKey);
            showToast('Versión PRO activada');
        } else {
            localStorage.removeItem('geminiApiKey');
            showToast('Usando versión gratuita');
        }
        domElements.apiKeyModal.classList.add('hidden');
    });

    domElements.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    domElements.messageInput.addEventListener('input', adjustTextareaHeight);

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(m => {
                m.classList.add('hidden');
                if (m.id === 'pdfViewerModal') {
                    pdfDoc = null;
                    currentPage = 1;
                    totalPages = 1;
                }
            });
        });
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
                if (modal.id === 'pdfViewerModal') {
                    pdfDoc = null;
                    currentPage = 1;
                    totalPages = 1;
                }
            }
        });
    });

    domElements.logoutBtn.addEventListener('click', async () => {
        setButtonLoading(domElements.logoutBtn, true);
        try {
            stopListeningToGlobalMessages();
            await auth.signOut();
            showToast('Sesión cerrada exitosamente');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        } catch (error) {
            showToast('Error al cerrar sesión', true);
        } finally {
            setButtonLoading(domElements.logoutBtn, false);
        }
    });

    domElements.themeToggleBtn.addEventListener('click', toggleTheme);
    setupPDFEventListeners();
}

function initUI() {
    createStarfield();
    checkAuthState();
    setupEventListeners();
    playBackgroundMusic();
}

document.addEventListener('DOMContentLoaded', initUI);