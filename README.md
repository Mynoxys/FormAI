# FormAI - Voice-First AI Form Coach

A production-ready real-time fitness coaching application that uses voice feedback to guide users through exercises with perfect form. The AI coach watches your movements via webcam and provides instant verbal corrections and encouragement.

## Features

### Voice-First AI Coaching
- Real-time voice feedback powered by Gemini AI
- Short, actionable corrections delivered through natural speech
- Phase-specific encouragement and motivation
- Automatic rep counting with voice confirmation
- Set completion summaries with performance metrics

### Advanced Form Analysis
- MediaPipe Pose detection for accurate body tracking
- Real-time joint angle calculations
- Phase detection for exercise movements
- Form quality scoring with instant feedback
- Critical form issue detection with priority-based voice alerts

### Workout Tracking with Supabase
- Automatic session tracking in database
- Individual rep data storage with form scores
- Historical performance analytics
- Personal best tracking
- User statistics across exercises

### Intelligent Feedback System
- Priority-based feedback queue
- Critical issues interrupt current speech
- Throttling to prevent repetitive corrections
- Natural language feedback generation
- Context-aware coaching based on exercise phase

### Supported Exercises
- Squats with comprehensive biomechanical analysis
- Push-ups (framework ready for expansion)
- Extensible system for adding new exercises

## Technology Stack

- **Frontend**: React 19 with TypeScript
- **AI**: Google Gemini 2.5 Flash with native audio
- **Pose Detection**: MediaPipe Pose via CDN
- **Database**: Supabase (PostgreSQL with RLS)
- **Build**: Vite 6
- **Styling**: Tailwind CSS utility classes

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- Webcam access
- Gemini API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd project
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables in `.env`:
```env
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run the development server:
```bash
npm run dev
```

5. Build for production:
```bash
npm run build
```

## Usage

### Form Tracker Mode
1. Select an exercise from the home screen
2. Position yourself so your full body is visible within the frame guide
3. Press "Start Workout" to begin coaching
4. Follow the AI voice coach's real-time feedback
5. Complete your reps while the AI monitors your form
6. Press the back button to finish and save your session

### AI Coach Mode
1. Navigate to "AI Coach" tab in the footer
2. Press the microphone button to start a conversation
3. Ask questions about form, technique, or get general coaching advice
4. The AI coach responds with natural voice interaction
5. Press the microphone button again to end the session

## Architecture

### Voice Feedback System
The voice feedback service manages a priority queue where:
- **Critical** issues (knees caving in, knees over toes) interrupt current speech
- **Important** issues (chest down, depth problems) queue normally
- **Normal** feedback (phase transitions) plays when queue is empty
- **Encouragement** messages fill gaps between corrections

### Form Analysis Pipeline
1. MediaPipe Pose extracts 33 body landmarks
2. Joint angles calculated for knees, hips, and torso
3. Phase detector determines exercise state (standing, descending, bottom, ascending)
4. Form analysis compares measurements against ideal ranges
5. Feedback generator creates natural language corrections
6. Voice queue prioritizes and delivers audio feedback

### Database Schema
- **workout_sessions**: Tracks complete workout sessions with metadata
- **workout_reps**: Stores individual rep data with form scores and phase information
- **user_stats**: Aggregated statistics for progress tracking

## Project Structure

```
project/
├── components/
│   ├── ExerciseTracker.tsx    # Main workout tracking component
│   ├── Conversation.tsx        # Voice chat with AI coach
│   └── Icons.tsx               # SVG icon components
├── services/
│   ├── geminiService.ts        # Gemini API integration
│   ├── voiceFeedbackService.ts # Voice feedback queue and templates
│   └── supabaseClient.ts       # Database operations
├── utils/
│   ├── squatAnalysis.ts        # Exercise phase detection and form analysis
│   └── poseUtils.ts            # Pose manipulation and angle calculations
├── types.ts                    # TypeScript type definitions
└── App.tsx                     # Main application shell
```

## Development

### Adding New Exercises
1. Define exercise configuration in `EXERCISE_CONFIG`
2. Create form analysis logic in utils
3. Add phase detection if needed
4. Define voice feedback templates
5. Update exercise type definitions

### Customizing Voice Feedback
Edit `feedbackTemplates` in `voiceFeedbackService.ts`:
- Add new form correction messages
- Customize motivational phrases
- Adjust coaching personality
- Modify feedback priority levels

### Extending Database Schema
Use Supabase migrations to:
- Add new exercise types
- Store additional metrics
- Create custom analytics views
- Implement user authentication

## Production Deployment

The application is production-ready with:
- Optimized Vite build configuration
- Environment variable management
- Error handling and fallbacks
- Responsive design for all screen sizes
- Secure database access with RLS policies

Build the production bundle:
```bash
npm run build
```

The output will be in the `dist/` directory, ready for deployment to any static hosting service.

## Performance Considerations

- MediaPipe Pose runs at ~30 FPS on modern hardware
- Voice feedback is throttled to prevent repetition (3 second cooldown)
- Form scores are calculated per frame but only critical issues trigger voice
- Database writes are batched per rep, not per frame
- Audio generation uses Gemini's streaming TTS for low latency

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support with WebRTC
- Mobile browsers: Supported but desktop recommended for best experience

## License

All rights reserved.

## Acknowledgments

- MediaPipe team for pose detection technology
- Google Gemini team for voice AI capabilities
- Supabase for database infrastructure
