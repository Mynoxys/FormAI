import { generateSpeech } from './geminiService';
import { SquatPhase } from '../utils/squatAnalysis';

export type FeedbackPriority = 'critical' | 'important' | 'normal' | 'encouragement';

export interface VoiceFeedback {
  message: string;
  priority: FeedbackPriority;
  timestamp: number;
  category: 'form' | 'rep' | 'phase' | 'motivation' | 'instruction';
}

class VoiceFeedbackQueue {
  private queue: VoiceFeedback[] = [];
  private isSpeaking: boolean = false;
  private lastSpokenMessages: Map<string, number> = new Map();
  private readonly THROTTLE_DURATION = 3000;
  private currentAudioSource: AudioBufferSourceNode | null = null;

  async addFeedback(feedback: VoiceFeedback) {
    const now = Date.now();
    const lastSpoken = this.lastSpokenMessages.get(feedback.message) || 0;

    console.log('[Voice Queue] Adding feedback:', feedback.message, 'Priority:', feedback.priority);

    if (now - lastSpoken < this.THROTTLE_DURATION) {
      console.log('[Voice Queue] Throttled - message spoken recently');
      return;
    }

    if (feedback.priority === 'critical') {
      console.log('[Voice Queue] Critical priority - interrupting current speech');
      this.queue.unshift(feedback);
      if (this.isSpeaking) {
        this.stopCurrentSpeech();
      }
      await this.processQueue();
    } else {
      this.queue.push(feedback);
      console.log('[Voice Queue] Queue length:', this.queue.length);
      if (!this.isSpeaking) {
        await this.processQueue();
      }
    }
  }

  private async processQueue() {
    if (this.queue.length === 0 || this.isSpeaking) {
      console.log('[Voice Queue] Cannot process - queue empty or already speaking');
      return;
    }

    this.queue.sort((a, b) => {
      const priorityOrder: Record<FeedbackPriority, number> = {
        critical: 0,
        important: 1,
        normal: 2,
        encouragement: 3,
      };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    const feedback = this.queue.shift();
    if (!feedback) return;

    this.isSpeaking = true;
    this.lastSpokenMessages.set(feedback.message, Date.now());
    console.log('[Voice Queue] ▶ Processing feedback:', feedback.message, 'Priority:', feedback.priority);

    try {
      const audioSource = await generateSpeech(feedback.message);
      this.currentAudioSource = audioSource;
      console.log('[Voice Queue] Audio source stored:', audioSource !== null);

      // Wait a bit before processing next item
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error('[Voice Queue] ✗ Error speaking feedback:', error);
    } finally {
      this.isSpeaking = false;
      this.currentAudioSource = null;
      console.log('[Voice Queue] ■ Finished processing. Queue length:', this.queue.length);

      if (this.queue.length > 0) {
        console.log('[Voice Queue] Processing next item in queue...');
        this.processQueue();
      }
    }
  }

  private stopCurrentSpeech() {
    console.log('[Voice Queue] ■ Stopping current speech');
    if (this.currentAudioSource) {
      try {
        this.currentAudioSource.stop();
        console.log('[Voice Queue] Audio source stopped');
      } catch (e) {
        console.warn('[Voice Queue] Could not stop audio source:', e);
      }
      this.currentAudioSource = null;
    }
    this.isSpeaking = false;
  }

  clear() {
    console.log('[Voice Queue] Clearing queue. Current length:', this.queue.length);
    this.queue = [];
    this.stopCurrentSpeech();
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getStatus(): { queueLength: number; isSpeaking: boolean } {
    return {
      queueLength: this.queue.length,
      isSpeaking: this.isSpeaking,
    };
  }
}

export const voiceFeedbackQueue = new VoiceFeedbackQueue();

export const feedbackTemplates = {
  form: {
    kneesCaveIn: ['Push your knees out', 'Keep knees wide', 'Knees out'],
    kneesOverToes: ['Knees behind toes', 'Shift back', 'Weight on heels'],
    chestDown: ['Chest up', 'Keep chest proud', 'Lift your chest'],
    notDeepEnough: ['Go lower', 'Deeper', 'Drop lower'],
    goodDepth: ['Perfect depth', 'Great depth', 'Nice'],
    backRounding: ['Straight back', 'Neutral spine', 'Back straight'],
  },
  phase: {
    standing: ['Ready', 'Set', 'Go'],
    descending: ['Control it', 'Nice and slow', 'Good tempo'],
    bottom: ['Drive up', 'Push', 'Explode up'],
    ascending: ['Keep pushing', 'Almost there', 'Finish strong'],
  },
  rep: {
    repComplete: ['One', 'Good', 'Nice rep', 'Great form'],
    repWithCount: (count: number) => [`${count}`, `${count} reps`, `That's ${count}`],
    excellentRep: ['Perfect', 'Excellent', 'Outstanding', 'Flawless'],
  },
  set: {
    setComplete: (setNum: number, avgScore: number) =>
      avgScore >= 85
        ? `Set ${setNum} complete! Excellent form!`
        : avgScore >= 70
        ? `Set ${setNum} done! Good work!`
        : `Set ${setNum} finished! Keep improving!`,
    restTime: ['Rest now', 'Take a break', 'Breathe'],
  },
  motivation: {
    keepGoing: ['You got this', 'Keep going', 'Don\'t stop', 'Push through'],
    almostDone: ['Almost there', 'Few more', 'Finish strong'],
    excellent: ['Amazing', 'Incredible', 'Phenomenal'],
    improvement: ['Getting better', 'Nice improvement', 'You\'re improving'],
  },
  instruction: {
    start: ['Let\'s go', 'Starting now', 'Begin'],
    position: ['Position yourself', 'Get ready', 'Set up'],
    stepBack: ['Step back', 'Move back', 'I need to see your full body'],
    allGood: ['Looking good', 'Perfect position', 'Ready to start'],
  },
};

export const getRandomTemplate = (templates: string[]): string => {
  return templates[Math.floor(Math.random() * templates.length)];
};

export const generateFormFeedback = (
  kneesCaveIn: boolean,
  kneesOverToes: boolean,
  torsoAngle: number,
  depth: number,
  phase: SquatPhase
): VoiceFeedback | null => {
  if (kneesCaveIn) {
    return {
      message: getRandomTemplate(feedbackTemplates.form.kneesCaveIn),
      priority: 'critical',
      timestamp: Date.now(),
      category: 'form',
    };
  }

  if (kneesOverToes) {
    return {
      message: getRandomTemplate(feedbackTemplates.form.kneesOverToes),
      priority: 'critical',
      timestamp: Date.now(),
      category: 'form',
    };
  }

  if (torsoAngle > 30) {
    return {
      message: getRandomTemplate(feedbackTemplates.form.chestDown),
      priority: 'important',
      timestamp: Date.now(),
      category: 'form',
    };
  }

  if (phase === 'bottom' && depth < 50) {
    return {
      message: getRandomTemplate(feedbackTemplates.form.notDeepEnough),
      priority: 'important',
      timestamp: Date.now(),
      category: 'form',
    };
  }

  return null;
};

export const generatePhaseFeedback = (phase: SquatPhase): VoiceFeedback => {
  return {
    message: getRandomTemplate(feedbackTemplates.phase[phase]),
    priority: 'normal',
    timestamp: Date.now(),
    category: 'phase',
  };
};

export const generateRepFeedback = (repCount: number, formScore: number): VoiceFeedback => {
  const templates = feedbackTemplates.rep;

  if (formScore >= 90) {
    return {
      message: getRandomTemplate(templates.excellentRep),
      priority: 'encouragement',
      timestamp: Date.now(),
      category: 'rep',
    };
  } else {
    return {
      message: `${repCount}`,
      priority: 'normal',
      timestamp: Date.now(),
      category: 'rep',
    };
  }
};

export const generateSetCompleteFeedback = (setNum: number, avgScore: number): VoiceFeedback => {
  return {
    message: feedbackTemplates.set.setComplete(setNum, avgScore),
    priority: 'important',
    timestamp: Date.now(),
    category: 'motivation',
  };
};

export const generateMotivationFeedback = (progress: number): VoiceFeedback | null => {
  if (progress > 0.8) {
    return {
      message: getRandomTemplate(feedbackTemplates.motivation.almostDone),
      priority: 'encouragement',
      timestamp: Date.now(),
      category: 'motivation',
    };
  }
  return null;
};
