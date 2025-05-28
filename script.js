class Calculator {
    constructor() {
        this.previousOperandElement = document.querySelector('.previous-operand');
        this.currentOperandElement = document.querySelector('.current-operand');
        this.voiceButton = document.getElementById('voiceButton');
        this.voiceStatus = document.getElementById('voiceStatus');
        this.voiceText = document.getElementById('voiceText');
        this.voiceFeedback = document.querySelector('.voice-feedback');
        this.historyList = document.getElementById('historyList');
        this.clearHistoryButton = document.getElementById('clearHistory');
        this.themeToggle = document.querySelector('.theme-toggle');
        this.memory = 0;
        this.lastResult = 0;
        this.currentLanguage = 'en-US';
        this.calculationHistory = [];
        this.voiceConfidence = 0;
        this.voiceRetryCount = 0;
        this.maxRetries = 3;
        this.googleAPIKey = ''; // You'll need to add your Google API key here
        this.openAIKey = ''; // Add your OpenAI API key here
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.currentOperand = '0';
        this.previousOperand = '';
        this.operation = undefined;
        this.clear();
        this.setupVoiceRecognition();
        this.setupThemeToggle();
        this.setupHistoryClear();
        this.setupWaveSurfer();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Number buttons
        document.querySelectorAll('.number').forEach(button => {
            button.addEventListener('click', () => {
                this.appendNumber(button.innerText);
                this.updateDisplay();
            });
        });

        // Operator buttons
        document.querySelectorAll('.operator').forEach(button => {
            button.addEventListener('click', () => {
                const action = button.dataset.action;
                switch (action) {
                    case 'clear':
                        this.clear();
                        break;
                    case 'delete':
                        this.delete();
                        break;
                    case 'calculate':
                        this.calculate();
                        break;
                    case 'square':
                        this.square();
                        break;
                    case 'sqrt':
                        this.sqrt();
                        break;
                    case 'memory':
                        this.memoryAdd();
                        break;
                    case 'power':
                        this.chooseOperation('power');
                        break;
                    default:
                        this.chooseOperation(button.innerText);
                        break;
                }
                this.updateDisplay();
            });
        });

        // Keyboard support
        document.addEventListener('keydown', (event) => {
            if (event.key >= '0' && event.key <= '9' || event.key === '.') {
                this.appendNumber(event.key);
            } else if (event.key === '+') {
                this.chooseOperation('+');
            } else if (event.key === '-') {
                this.chooseOperation('-');
            } else if (event.key === '*') {
                this.chooseOperation('×');
            } else if (event.key === '/') {
                this.chooseOperation('÷');
            } else if (event.key === 'Enter' || event.key === '=') {
                this.calculate();
            } else if (event.key === 'Backspace') {
                this.delete();
            } else if (event.key === 'Escape') {
                this.clear();
            }
            this.updateDisplay();
        });
    }

    setupWaveSurfer() {
        this.wavesurfer = WaveSurfer.create({
            container: '#voiceWaveform',
            waveColor: getComputedStyle(document.documentElement).getPropertyValue('--text-color'),
            progressColor: getComputedStyle(document.documentElement).getPropertyValue('--primary-color'),
            height: 60,
            responsive: true,
            normalize: true,
            barWidth: 2,
            barGap: 1
        });
    }

    setupHistoryClear() {
        this.clearHistoryButton.addEventListener('click', () => {
            this.calculationHistory = [];
            this.updateHistoryDisplay();
        });
    }

    setupVoiceRecognition() {
        if ('webkitSpeechRecognition' in window) {
            this.setupOpenAISpeechRecognition();
        } else {
            this.voiceButton.style.display = 'none';
            this.voiceStatus.textContent = 'Voice control not supported';
        }
    }

    setupOpenAISpeechRecognition() {
        this.recognition = new webkitSpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 5;
        this.recognition.lang = this.currentLanguage;

        this.recognition.onstart = async () => {
            this.voiceButton.classList.add('listening');
            this.voiceStatus.textContent = 'Listening...';
            this.voiceFeedback.classList.add('active');
            this.voiceText.textContent = '';
            this.wavesurfer.start();
            
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.mediaRecorder = new MediaRecorder(stream);
                this.audioChunks = [];

                this.mediaRecorder.ondataavailable = (event) => {
                    this.audioChunks.push(event.data);
                };

                this.mediaRecorder.start();
            } catch (error) {
                console.error('Error accessing microphone:', error);
                this.voiceStatus.textContent = 'Error accessing microphone';
            }
        };

        this.recognition.onend = async () => {
            this.voiceButton.classList.remove('listening');
            this.voiceStatus.textContent = `Click to start voice control (${this.currentLanguage === 'en-US' ? 'English' : 'Hindi'})`;
            this.voiceFeedback.classList.remove('active');
            this.wavesurfer.stop();

            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
                this.mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                    await this.processWithOpenAI(audioBlob);
                };
            }
        };

        this.recognition.onresult = async (event) => {
            const results = event.results;
            const lastResult = results[results.length - 1];
            const transcript = lastResult[0].transcript.toLowerCase();
            const confidence = lastResult[0].confidence;

            this.voiceText.textContent = transcript;
            this.voiceStatus.textContent = `Confidence: ${(confidence * 100).toFixed(1)}%`;

            if (confidence > 0.6) {
                this.processVoiceCommand(transcript);
            } else {
                this.voiceStatus.textContent = 'Please speak more clearly';
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Voice recognition error:', event.error);
            this.voiceStatus.textContent = `Error: ${event.error}. Please try again.`;
            this.voiceFeedback.classList.remove('active');
            this.wavesurfer.stop();
        };

        this.voiceButton.addEventListener('click', () => {
            if (this.voiceButton.classList.contains('listening')) {
                this.recognition.stop();
            } else {
                this.toggleLanguage();
                this.recognition.start();
            }
        });
    }

    async processWithOpenAI(audioBlob) {
        if (!this.openAIKey) {
            console.warn('OpenAI API key not set');
            return;
        }

        try {
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64Audio = reader.result.split(',')[1];

                const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.openAIKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'whisper-1',
                        language: this.currentLanguage === 'en-US' ? 'en' : 'hi',
                        response_format: 'json',
                        audio: base64Audio
                    })
                });

                const data = await response.json();
                if (data.text) {
                    const enhancedTranscript = data.text.toLowerCase();
                    this.voiceText.textContent = enhancedTranscript;
                    this.processVoiceCommand(enhancedTranscript);
                }
            };
        } catch (error) {
            console.error('Error processing with OpenAI:', error);
            this.voiceStatus.textContent = 'Error processing voice command';
        }
    }

    processVoiceCommand(command) {
        console.log('Processing voice command:', command); // Debug log
        const processedCommand = this.preprocessCommand(command);
        console.log('Processed command:', processedCommand); // Debug log

        try {
            // Handle clear and delete commands
            if (processedCommand.includes('clear') || processedCommand.includes('साफ़')) {
                this.clear();
                this.voiceStatus.textContent = 'Calculator cleared';
                return;
            }
            if (processedCommand.includes('delete') || processedCommand.includes('हटाओ')) {
                this.delete();
                this.voiceStatus.textContent = 'Last digit deleted';
                return;
            }

            // Handle memory commands
            if (processedCommand.includes('memory')) {
                this.handleMemoryCommand(processedCommand);
                return;
            }

            // Extract numbers from the command
            const numberPattern = /\d+(\.\d+)?/g;
            const numbers = processedCommand.match(numberPattern);
            console.log('Extracted numbers:', numbers); // Debug log

            if (!numbers || numbers.length === 0) {
                console.log('No numbers found in command'); // Debug log
                return;
            }

            // Handle basic number input
            if (numbers.length === 1 && !processedCommand.includes('plus') && 
                !processedCommand.includes('minus') && !processedCommand.includes('multiply') && 
                !processedCommand.includes('divide') && !processedCommand.includes('square') && 
                !processedCommand.includes('root')) {
                console.log('Adding single number:', numbers[0]); // Debug log
                this.appendNumber(numbers[0]);
                this.updateDisplay();
                return;
            }

            // Handle operations
            if (numbers.length >= 1) {
                console.log('Handling operation with numbers:', numbers); // Debug log
                this.handleCalculationCommand(processedCommand, numbers);
            }
        } catch (error) {
            console.error('Error in processVoiceCommand:', error); // Debug log
            this.handleError(error.message);
        }
    }

    appendNumber(number) {
        console.log('Appending number:', number); // Debug log
        if (number === '.' && this.currentOperand.includes('.')) return;
        
        // Convert number to string if it's not already
        const numberStr = number.toString();
        
        if (this.currentOperand === '0' && numberStr !== '.') {
            this.currentOperand = numberStr;
        } else {
            this.currentOperand = this.currentOperand.toString() + numberStr;
        }
        
        console.log('Current operand after append:', this.currentOperand); // Debug log
        this.updateDisplay();
    }

    handleCalculationCommand(command, numbers) {
        console.log('Handling calculation command:', command, numbers); // Debug log
        
        // First number
        this.appendNumber(numbers[0]);
        
        // Determine operation
        let operation = null;
        if (command.includes('plus') || command.includes('add') || command.includes('जोड़')) {
            operation = '+';
        } else if (command.includes('minus') || command.includes('subtract') || command.includes('घटाओ')) {
            operation = '-';
        } else if (command.includes('multiply') || command.includes('times') || command.includes('गुणा')) {
            operation = '×';
        } else if (command.includes('divide') || command.includes('भाग')) {
            operation = '÷';
        } else if (command.includes('square') || command.includes('वर्ग')) {
            this.square();
            this.calculate();
            return;
        } else if (command.includes('square root') || command.includes('वर्गमूल')) {
            this.sqrt();
            this.calculate();
            return;
        }

        if (operation) {
            this.chooseOperation(operation);
            if (numbers[1]) {
                this.appendNumber(numbers[1]);
                this.calculate();
            }
        }
    }

    clear() {
        this.currentOperand = '0';
        this.previousOperand = '';
        this.operation = undefined;
        this.updateDisplay();
    }

    delete() {
        if (this.currentOperand === '0') return;
        this.currentOperand = this.currentOperand.toString().slice(0, -1);
        if (this.currentOperand === '') this.currentOperand = '0';
        this.updateDisplay();
    }

    chooseOperation(operation) {
        if (this.currentOperand === '') return;
        if (this.previousOperand !== '') {
            this.calculate();
        }
        this.operation = operation;
        this.previousOperand = this.currentOperand;
        this.currentOperand = '0';
        this.updateDisplay();
    }

    square() {
        const current = parseFloat(this.currentOperand);
        this.currentOperand = (current * current).toString();
    }

    sqrt() {
        const current = parseFloat(this.currentOperand);
        if (current < 0) {
            alert('Cannot calculate square root of negative number!');
            return;
        }
        this.currentOperand = Math.sqrt(current).toString();
    }

    memoryAdd() {
        const currentValue = parseFloat(this.currentOperand);
        if (!isNaN(currentValue)) {
            this.memory += currentValue;
            this.voiceStatus.textContent = `Added ${this.getDisplayNumber(currentValue)} to memory`;
            this.showMemoryNotification();
        }
    }

    memorySubtract() {
        const currentValue = parseFloat(this.currentOperand);
        if (!isNaN(currentValue)) {
            this.memory -= currentValue;
            this.voiceStatus.textContent = `Subtracted ${this.getDisplayNumber(currentValue)} from memory`;
            this.showMemoryNotification();
        }
    }

    memoryRecall() {
        if (this.memory !== 0) {
            this.currentOperand = this.memory.toString();
            this.updateDisplay();
            this.voiceStatus.textContent = `Recalled ${this.getDisplayNumber(this.memory)} from memory`;
        }
    }

    memoryClear() {
        this.memory = 0;
        this.voiceStatus.textContent = 'Memory cleared';
    }

    showMemoryNotification() {
        const notification = document.createElement('div');
        notification.className = 'memory-notification';
        notification.textContent = `Memory: ${this.getDisplayNumber(this.memory)}`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 2000);
    }

    async calculate() {
        try {
            let computation;
            const prev = parseFloat(this.previousOperand);
            const current = parseFloat(this.currentOperand);
            
            if (isNaN(prev) || isNaN(current)) return;

            switch (this.operation) {
                case '+':
                    computation = prev + current;
                    break;
                case '-':
                    computation = prev - current;
                    break;
                case '×':
                    computation = prev * current;
                    break;
                case '÷':
                    if (current === 0) {
                        throw new Error('Cannot divide by zero');
                    }
                    computation = prev / current;
                    break;
                case '%':
                    computation = prev % current;
                    break;
                case 'power':
                    computation = Math.pow(prev, current);
                    break;
                default:
                    return;
            }

            if (Math.abs(computation) > 1e9) {
                try {
                    const response = await fetch(`https://api.mathjs.org/v4/?expr=${encodeURIComponent(computation)}`);
                    const data = await response.json();
                    computation = data;
                } catch (error) {
                    console.error('Error calculating large numbers:', error);
                    throw new Error('Error calculating large numbers');
                }
            }

            this.lastResult = computation;
            this.currentOperand = computation.toString();
            this.operation = undefined;
            this.previousOperand = '';

            this.addToHistory(
                `${this.getDisplayNumber(prev)} ${this.operation} ${this.getDisplayNumber(current)}`,
                computation
            );

            this.updateDisplay();
            return computation;
        } catch (error) {
            this.handleError(error.message);
            return null;
        }
    }

    handleError(errorMessage) {
        this.voiceStatus.textContent = `Error: ${errorMessage}`;
        this.currentOperand = 'Error';
        this.updateDisplay();
        setTimeout(() => {
            this.clear();
            this.voiceStatus.textContent = 'Calculator cleared due to error';
        }, 2000);
    }

    getDisplayNumber(number) {
        const stringNumber = number.toString();
        const integerDigits = parseFloat(stringNumber.split('.')[0]);
        const decimalDigits = stringNumber.split('.')[1];
        let integerDisplay;
        
        if (isNaN(integerDigits)) {
            integerDisplay = '0';
        } else {
            integerDisplay = integerDigits.toLocaleString('en', {
                maximumFractionDigits: 0
            });
        }

        if (decimalDigits != null) {
            const limitedDecimals = decimalDigits.slice(0, 8);
            return `${integerDisplay}.${limitedDecimals}`;
        } else {
            return integerDisplay;
        }
    }

    updateDisplay() {
        console.log('Updating display - Current:', this.currentOperand, 'Previous:', this.previousOperand); // Debug log
        this.currentOperandElement.innerText = this.getDisplayNumber(this.currentOperand);
        if (this.operation != null) {
            this.previousOperandElement.innerText = 
                `${this.getDisplayNumber(this.previousOperand)} ${this.operation}`;
        } else {
            this.previousOperandElement.innerText = '';
        }
    }

    addToHistory(calculation, result) {
        const historyItem = {
            calculation,
            result,
            timestamp: new Date().toLocaleTimeString()
        };
        this.calculationHistory.unshift(historyItem);
        if (this.calculationHistory.length > 5) {
            this.calculationHistory.pop();
        }
        this.updateHistoryDisplay();
    }

    updateHistoryDisplay() {
        this.historyList.innerHTML = this.calculationHistory
            .map(item => `
                <div class="history-item">
                    <span class="history-calculation">${item.calculation}</span>
                    <span class="history-result">= ${this.getDisplayNumber(item.result)}</span>
                    <span class="history-time">${item.timestamp}</span>
                </div>
            `)
            .join('');
    }

    setupThemeToggle() {
        this.themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
        });
    }

    toggleLanguage() {
        this.currentLanguage = this.currentLanguage === 'en-US' ? 'hi-IN' : 'en-US';
        this.recognition.lang = this.currentLanguage;
        this.voiceStatus.textContent = `Language: ${this.currentLanguage === 'en-US' ? 'English' : 'Hindi'}`;
    }

    preprocessCommand(command) {
        console.log('Preprocessing command:', command); // Debug log
        const numberWords = {
            'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
            'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
            'ten': '10', 'point': '.', 'decimal': '.',
            'शून्य': '0', 'एक': '1', 'दो': '2', 'तीन': '3', 'चार': '4',
            'पांच': '5', 'छह': '6', 'सात': '7', 'आठ': '8', 'नौ': '9',
            'दस': '10', 'बिंदु': '.'
        };

        let processed = command.toLowerCase();
        Object.entries(numberWords).forEach(([word, number]) => {
            processed = processed.replace(new RegExp(`\\b${word}\\b`, 'g'), number);
        });

        console.log('Processed command result:', processed); // Debug log
        return processed;
    }

    handleMemoryCommand(command) {
        if (command.includes('add') || command.includes('जोड़')) {
            this.memoryAdd();
        } else if (command.includes('subtract') || command.includes('घटाओ')) {
            this.memorySubtract();
        } else if (command.includes('recall') || command.includes('याद')) {
            this.memoryRecall();
        } else if (command.includes('clear') || command.includes('साफ़')) {
            this.memoryClear();
        }
    }
}

const calculator = new Calculator();

// Add CSS for better voice feedback
const style = document.createElement('style');
style.textContent = `
    .voice-feedback {
        transition: all 0.3s ease;
    }

    .voice-feedback.active {
        background: var(--button-bg);
        border-radius: 10px;
        padding: 10px;
        margin: 10px 0;
    }

    .voice-text {
        font-size: 1.1rem;
        margin: 10px 0;
        color: var(--text-color);
    }

    .voice-status {
        font-size: 0.9rem;
        color: var(--text-color);
        opacity: 0.8;
    }

    .voice-button.listening {
        animation: pulse 1.5s infinite;
        background: var(--primary-color);
        color: white;
    }

    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
    }
`;
document.head.appendChild(style); 