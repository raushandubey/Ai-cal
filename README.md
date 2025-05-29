# Smart AI Calculator

A modern calculator web application with voice control capabilities, built using HTML, CSS, and JavaScript.

## Features

- **Voice Control**
  - Supports both English and Hindi voice commands
  - Real-time voice feedback with waveform visualization
  - AI-powered voice recognition using OpenAI Whisper API

- **Calculator Functions**
  - Basic arithmetic operations (+, -, ×, ÷)
  - Advanced operations (square, square root, power)
  - Memory functions (M+, M-, MR, MC)
  - Calculation history with timestamps
  - Keyboard support

- **User Interface**
  - Modern glass-morphism design
  - Dark/Light theme toggle
  - Responsive layout for all devices
  - Clean and intuitive interface

## Setup

1. Clone the repository
2. Add your API keys in `script.js`:
```javascript
this.googleAPIKey = ''; // Add your Google API key
this.openAIKey = ''; // Add your OpenAI API key
```

3. Open `index.html` in a web browser

## Voice Commands

- Basic calculations: "Calculate two plus three"
- Clear calculator: "Clear" or "साफ़"
- Delete last digit: "Delete" or "हटाओ"
- Memory operations: "Add to memory", "Recall memory"

## Technical Stack

- HTML5
- CSS3 with CSS Variables
- Vanilla JavaScript
- WaveSurfer.js for audio visualization
- Web Speech API
- OpenAI Whisper API for enhanced voice recognition

## Browser Support

- Chrome (recommended for voice features)
- Firefox
- Safari
- Edge

## Contributing

Feel free to submit issues and enhancement requests.

## License

This project is licensed under the MIT License.

## Credits

Designed and developed by Raushan Dubey