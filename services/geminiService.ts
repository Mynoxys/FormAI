
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

export const generateSpeech = async (text: string): Promise<void> => {
    try {
        const aiClient = getAIClient();
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

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            const audioContext = getOutputAudioContext();
            const audioBuffer = await decodeAudioData(
                decode(base64Audio),
                audioContext,
                24000,
                1
            );
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            // Fix: The start() method of AudioBufferSourceNode requires an argument in some environments.
            // Passing 0 ensures it plays immediately and avoids a potential "Expected 1 arguments, but got 0" error.
            source.start(0);
        }
    } catch (error) {
        console.error("Error generating speech:", error);
    }
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
