// Constants
const LANGUAGES = {
    EN: 'English',
    GU: 'Gujarati',
    HI: 'Hindi',
    ES: 'Spanish',
    FR: 'French',
    DE: 'German',
    JA: 'Japanese',
};
const LANGUAGE_LIST = Object.values(LANGUAGES);

const SPEECH_RECOGNITION_LANGS = {
    'English': 'en-US',
    'Gujarati': 'gu-IN',
    'Hindi': 'hi-IN',
    'Spanish': 'es-ES',
    'French': 'fr-FR',
    'German': 'de-DE',
    'Japanese': 'ja-JP',
};

const DEBOUNCE_DELAY = 500;

// State
let state = {
    sourceLang: 'English',
    targetLang: 'Gujarati',
    ocrTargetLang: 'Gujarati',
    sourceText: '',
    translatedText: '',
    imageFile: null,
    isListening: false,
};

// DOM Elements
const dom = {
    navTranslator: document.getElementById('nav-translator'),
    navOcr: document.getElementById('nav-ocr'),
    viewTranslator: document.getElementById('view-translator'),
    viewOcr: document.getElementById('view-ocr'),
    
    // Translator
    sourceLang: document.getElementById('source-lang'),
    targetLang: document.getElementById('target-lang'),
    sourceText: document.getElementById('source-text'),
    targetTextContent: document.getElementById('target-text-content'),
    targetTextPlaceholder: document.getElementById('target-text-placeholder'),
    targetError: document.getElementById('target-error'),
    loaderTranslate: document.getElementById('loader-translate'),
    btnSwap: document.getElementById('btn-swap'),
    btnMic: document.getElementById('btn-mic'),
    micIndicator: document.getElementById('mic-indicator'),
    btnSpeak: document.getElementById('btn-speak'),
    loaderSpeak: document.getElementById('loader-speak'),
    iconSpeak: document.getElementById('icon-speak'),
    btnCopySource: document.getElementById('btn-copy-source'),
    btnCopyTarget: document.getElementById('btn-copy-target'),
    
    // OCR
    imageUpload: document.getElementById('image-upload'),
    fileName: document.getElementById('file-name'),
    ocrResultsContainer: document.getElementById('ocr-results-container'),
    imagePreview: document.getElementById('image-preview'),
    btnExtract: document.getElementById('btn-extract'),
    textExtractBtn: document.getElementById('text-extract-btn'),
    loaderExtract: document.getElementById('loader-extract'),
    extractedTextContent: document.getElementById('extracted-text-content'),
    extractedPlaceholder: document.getElementById('extracted-placeholder'),
    ocrTargetLang: document.getElementById('ocr-target-lang'),
    ocrTranslatedContent: document.getElementById('ocr-translated-content'),
    ocrTranslatedPlaceholder: document.getElementById('ocr-translated-placeholder'),
    loaderOcrTranslate: document.getElementById('loader-ocr-translate'),
    btnCopyExtracted: document.getElementById('btn-copy-extracted'),
    btnCopyOcrTranslated: document.getElementById('btn-copy-ocr-translated'),
    btnSpeakOcr: document.getElementById('btn-speak-ocr'),
    loaderSpeakOcr: document.getElementById('loader-speak-ocr'),
    iconSpeakOcr: document.getElementById('icon-speak-ocr'),
};

// Utility: Debounce
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// Utility: Audio Decoding
function decode(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// Decodes raw PCM audio data into an AudioBuffer for playback
// Gemini API returns raw PCM (Int16), so we cannot use standard context.decodeAudioData
function decodePCMData(data, ctx, sampleRate, numChannels) {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

let audioContext = null;
async function playAudio(base64Audio) {
    try {
        if (!audioContext || audioContext.state === 'closed') {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        }
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        const bytes = decode(base64Audio);
        
        // Use manual PCM decoding
        const audioBuffer = decodePCMData(bytes, audioContext, 24000, 1);
        
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();
    } catch (error) {
        console.error("Error playing audio:", error);
        alert("Failed to play audio.");
    }
}

// Initialization
function init() {
    populateLanguageDropdowns();
    setupNavigation();
    setupTranslator();
    setupOCR();
}

function populateLanguageDropdowns() {
    const options = LANGUAGE_LIST.map(lang => `<option value="${lang}">${lang}</option>`).join('');
    dom.sourceLang.innerHTML = options;
    dom.targetLang.innerHTML = options;
    dom.ocrTargetLang.innerHTML = options;

    // Set Defaults
    dom.sourceLang.value = 'English';
    dom.targetLang.value = 'Gujarati';
    dom.ocrTargetLang.value = 'Gujarati';
}

// Navigation
function setupNavigation() {
    dom.navTranslator.addEventListener('click', () => switchView('Translator'));
    dom.navOcr.addEventListener('click', () => switchView('OCR'));
}

function switchView(view) {
    if (view === 'Translator') {
        dom.viewTranslator.classList.remove('hidden');
        dom.viewOcr.classList.add('hidden');
        dom.navTranslator.classList.add('bg-brand-secondary', 'text-white', 'shadow');
        dom.navTranslator.classList.remove('text-slate-400', 'hover:bg-slate-700');
        dom.navOcr.classList.remove('bg-brand-secondary', 'text-white', 'shadow');
        dom.navOcr.classList.add('text-slate-400', 'hover:bg-slate-700');
    } else {
        dom.viewTranslator.classList.add('hidden');
        dom.viewOcr.classList.remove('hidden');
        dom.navOcr.classList.add('bg-brand-secondary', 'text-white', 'shadow');
        dom.navOcr.classList.remove('text-slate-400', 'hover:bg-slate-700');
        dom.navTranslator.classList.remove('bg-brand-secondary', 'text-white', 'shadow');
        dom.navTranslator.classList.add('text-slate-400', 'hover:bg-slate-700');
    }
}

// Translator Logic
function setupTranslator() {
    const debouncedTranslate = debounce(performTranslation, DEBOUNCE_DELAY);

    dom.sourceText.addEventListener('input', (e) => {
        state.sourceText = e.target.value;
        debouncedTranslate();
    });

    dom.sourceLang.addEventListener('change', (e) => {
        state.sourceLang = e.target.value;
        performTranslation();
    });

    dom.targetLang.addEventListener('change', (e) => {
        state.targetLang = e.target.value;
        performTranslation();
    });

    dom.btnSwap.addEventListener('click', () => {
        // Swap Langs
        const tempLang = state.sourceLang;
        state.sourceLang = state.targetLang;
        state.targetLang = tempLang;
        
        dom.sourceLang.value = state.sourceLang;
        dom.targetLang.value = state.targetLang;

        // Swap Text
        const currentTranslation = dom.targetTextContent.textContent;
        
        dom.sourceText.value = currentTranslation;
        state.sourceText = currentTranslation;
        
        performTranslation();
    });

    dom.btnMic.addEventListener('click', toggleSpeechRecognition);

    dom.btnSpeak.addEventListener('click', () => speakText(dom.targetTextContent.textContent, false));
    
    dom.btnCopySource.addEventListener('click', () => copyToClipboard(state.sourceText, dom.btnCopySource));
    dom.btnCopyTarget.addEventListener('click', () => copyToClipboard(dom.targetTextContent.textContent, dom.btnCopyTarget));
}

async function performTranslation() {
    if (!state.sourceText.trim()) {
        dom.targetTextContent.textContent = '';
        dom.targetTextContent.classList.add('hidden');
        dom.targetTextPlaceholder.classList.remove('hidden');
        return;
    }

    dom.loaderTranslate.classList.remove('hidden');
    dom.targetError.classList.add('hidden');

    try {
        const response = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: state.sourceText,
                source_lang: state.sourceLang,
                target_lang: state.targetLang
            })
        });
        
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);

        dom.targetTextContent.textContent = data.text;
        dom.targetTextContent.classList.remove('hidden');
        dom.targetTextPlaceholder.classList.add('hidden');
    } catch (error) {
        console.error(error);
        dom.targetError.textContent = 'Translation failed.';
        dom.targetError.classList.remove('hidden');
    } finally {
        dom.loaderTranslate.classList.add('hidden');
    }
}

// Speech Recognition
function toggleSpeechRecognition() {
    const langCode = SPEECH_RECOGNITION_LANGS[state.sourceLang];
    if (!('webkitSpeechRecognition' in window)) {
        alert('Speech recognition is not supported in this browser.');
        return;
    }

    if (state.isListening) {
        window.recognitionRef.stop();
        return; 
    }

    const recognition = new webkitSpeechRecognition();
    window.recognitionRef = recognition; 
    recognition.lang = langCode;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
        state.isListening = true;
        dom.micIndicator.classList.remove('hidden');
    };

    recognition.onend = () => {
        state.isListening = false;
        dom.micIndicator.classList.add('hidden');
    };

    recognition.onerror = (event) => {
        console.error("Speech Error", event.error);
        state.isListening = false;
        dom.micIndicator.classList.add('hidden');
    };

    recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            }
        }
        if (finalTranscript) {
            dom.sourceText.value += finalTranscript;
            state.sourceText = dom.sourceText.value;
            performTranslation();
        }
    };

    recognition.start();
}


// OCR Logic
function setupOCR() {
    dom.imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            state.imageFile = file;
            dom.fileName.textContent = file.name;
            const reader = new FileReader();
            reader.onload = (evt) => {
                dom.imagePreview.src = evt.target.result;
                dom.ocrResultsContainer.classList.remove('hidden');
                dom.extractedTextContent.textContent = '';
                dom.ocrTranslatedContent.textContent = '';
                dom.extractedPlaceholder.classList.remove('hidden');
                dom.ocrTranslatedPlaceholder.classList.remove('hidden');
                dom.extractedTextContent.classList.add('hidden');
                dom.ocrTranslatedContent.classList.add('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    dom.btnExtract.addEventListener('click', async () => {
        if (!state.imageFile) return;

        dom.btnExtract.disabled = true;
        dom.loaderExtract.classList.remove('hidden');
        dom.textExtractBtn.textContent = "Extracting...";

        const formData = new FormData();
        formData.append('image', state.imageFile);

        try {
            const response = await fetch('/api/ocr', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            
            if (data.error) throw new Error(data.error);

            const extracted = data.text;
            dom.extractedTextContent.textContent = extracted;
            dom.extractedTextContent.classList.remove('hidden');
            dom.extractedPlaceholder.classList.add('hidden');
            
            performOCRTranslation(extracted);

        } catch (error) {
            console.error(error);
            alert('OCR failed: ' + error.message);
        } finally {
            dom.btnExtract.disabled = false;
            dom.loaderExtract.classList.add('hidden');
            dom.textExtractBtn.textContent = "Extract Text";
        }
    });

    dom.ocrTargetLang.addEventListener('change', (e) => {
        state.ocrTargetLang = e.target.value;
        const currentExtracted = dom.extractedTextContent.textContent;
        if (currentExtracted) {
            performOCRTranslation(currentExtracted);
        }
    });

    dom.btnSpeakOcr.addEventListener('click', () => speakText(dom.ocrTranslatedContent.textContent, true));
    dom.btnCopyExtracted.addEventListener('click', () => copyToClipboard(dom.extractedTextContent.textContent, dom.btnCopyExtracted));
    dom.btnCopyOcrTranslated.addEventListener('click', () => copyToClipboard(dom.ocrTranslatedContent.textContent, dom.btnCopyOcrTranslated));
}

async function performOCRTranslation(text) {
    if (!text.trim()) return;
    
    dom.loaderOcrTranslate.classList.remove('hidden');
    
    try {
        const response = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                source_lang: 'Auto',
                target_lang: state.ocrTargetLang
            })
        });
        const data = await response.json();
        
        dom.ocrTranslatedContent.textContent = data.text;
        dom.ocrTranslatedContent.classList.remove('hidden');
        dom.ocrTranslatedPlaceholder.classList.add('hidden');

    } catch (error) {
        console.error(error);
    } finally {
        dom.loaderOcrTranslate.classList.add('hidden');
    }
}

// Shared: Audio & Copy
async function speakText(text, isOcr) {
    if (!text) return;

    const loader = isOcr ? dom.loaderSpeakOcr : dom.loaderSpeak;
    const icon = isOcr ? dom.iconSpeakOcr : dom.iconSpeak;

    loader.classList.remove('hidden');
    icon.classList.add('hidden');

    try {
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        await playAudio(data.audio);
    } catch (error) {
        console.error(error);
        alert('TTS failed.');
    } finally {
        loader.classList.add('hidden');
        icon.classList.remove('hidden');
    }
}

function copyToClipboard(text, btnElement) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    
    const copyIcon = btnElement.querySelector('.icon-copy');
    const checkIcon = btnElement.querySelector('.icon-check');
    
    copyIcon.classList.add('hidden');
    checkIcon.classList.remove('hidden');
    
    setTimeout(() => {
        copyIcon.classList.remove('hidden');
        checkIcon.classList.add('hidden');
    }, 2000);
}

// Run
init();
