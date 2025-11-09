
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";

let ai: GoogleGenAI;

const getAIClient = () => {
    if (!ai) {
        const apiKey = import.meta.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY environment variable not set");
        }
        ai = new GoogleGenAI({ apiKey });
    }
    return ai;
};

// Audio decoding utilities
const decode = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

const decodeAudioData = async (
    // Fix: Corrected typo from Uint8Aray to Uint8Array.
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> => {
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
};

let outputAudioContext: AudioContext;
const getOutputAudioContext = () => {
    if (!outputAudioContext) {
        outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    return outputAudioContext;
}

export const initializeAudioContext = async (): Promise<void> => {
    console.log('[Audio Init] Initializing AudioContext...');
    const ctx = getOutputAudioContext();
    console.log('[Audio Init] Current AudioContext state:', ctx.state);
    console.log('[Audio Init] Sample rate:', ctx.sampleRate);
    console.log('[Audio Init] Destination channels:', ctx.destination.maxChannelCount);

    if (ctx.state === 'suspended') {
        console.log('[Audio Init] AudioContext is suspended, attempting to resume...');
        try {
            await ctx.resume();
            console.log('[Audio Init] ✓ AudioContext resumed successfully. New state:', ctx.state);
        } catch (error) {
            console.error('[Audio Init] ✗ Failed to resume AudioContext:', error);
            throw error;
        }
    } else {
        console.log('[Audio Init] ✓ AudioContext already running');
    }

    // Test audio by playing a brief silent sound
    try {
        console.log('[Audio Init] Testing audio output with silent tone...');
        const testBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
        const testSource = ctx.createBufferSource();
        testSource.buffer = testBuffer;
        testSource.connect(ctx.destination);
        testSource.start(0);
        console.log('[Audio Init] ✓ Audio test completed - system ready for playback');
    } catch (error) {
        console.error('[Audio Init] ✗ Audio test failed:', error);
    }
};

export const generateSpeech = async (text: string): Promise<AudioBufferSourceNode | null> => {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('[Audio Debug] Starting speech generation for:', text);
            const audioContext = getOutputAudioContext();
            console.log('[Audio Debug] AudioContext state:', audioContext.state);

            if (audioContext.state === 'suspended') {
                console.log('[Audio Debug] Resuming suspended AudioContext...');
                await audioContext.resume();
                console.log('[Audio Debug] AudioContext resumed. New state:', audioContext.state);
            }

            const aiClient = getAIClient();
            console.log('[Audio Debug] Calling Gemini TTS API...');
            const response = await aiClient.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: 'Kore' },
                        },
                    },
                },
            });

            console.log('[Audio Debug] API Response received:', response);
            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

            if (base64Audio) {
                console.log('[Audio Debug] Base64 audio data length:', base64Audio.length);
                const decodedBytes = decode(base64Audio);
                console.log('[Audio Debug] Decoded bytes length:', decodedBytes.length);

                const audioBuffer = await decodeAudioData(
                    decodedBytes,
                    audioContext,
                    24000,
                    1
                );
                console.log('[Audio Debug] Audio buffer created. Duration:', audioBuffer.duration, 'seconds');

                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;

                // Create gain node for volume control
                const gainNode = audioContext.createGain();
                gainNode.gain.value = 1.0; // Maximum volume
                console.log('[Audio Debug] Gain node created with volume:', gainNode.gain.value);

                // Connect: source -> gainNode -> destination
                source.connect(gainNode);
                gainNode.connect(audioContext.destination);

                source.onended = () => {
                    console.log('[Audio Debug] ✓ Audio playback completed for:', text);
                    resolve(null);
                };

                console.log('[Audio Debug] Starting audio playback NOW...');
                source.start(0);
                console.log('[Audio Debug] ✓ Audio source started successfully');
                resolve(source);
            } else {
                console.error('[Audio Debug] ✗ No audio data received from Gemini API for:', text);
                console.error('[Audio Debug] Full response:', JSON.stringify(response, null, 2));
                resolve(null);
            }
        } catch (error) {
            console.error("[Audio Debug] ✗ Error generating speech:", error);
            console.error("[Audio Debug] Error details:", {
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                text: text
            });
            reject(error);
        }
    });
};

export const connectToLiveAPI = (callbacks: {
    onopen: () => void;
    onmessage: (message: LiveServerMessage) => void;
    onerror: (e: ErrorEvent) => void;
    onclose: (e: CloseEvent) => void;
}) => {
    const aiClient = getAIClient();
    return aiClient.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks,
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
            systemInstruction: 'You are FormAI, a friendly and helpful fitness coach. Keep your answers concise and encouraging.',
            inputAudioTranscription: {},
            outputAudioTranscription: {},
        },
    });
};

export { decode, decodeAudioData };
