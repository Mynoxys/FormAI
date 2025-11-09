
import React, { useState, useRef, useEffect, useCallback } from 'react';
// Fix: Replaced the non-exported `StartLiveSessionResponse` type with the correct `InteractiveSession` type for the live session object.
// Fix: Removed `InteractiveSession` from import as it is not an exported member. The type will be inferred.
import { LiveServerMessage, Blob } from '@google/genai';
import { connectToLiveAPI, decode, decodeAudioData } from '../services/geminiService';
import { MicIcon, MicOffIcon } from './Icons';

// Audio encoding utility
const encode = (bytes: Uint8Array) => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

const createBlob = (data: Float32Array): Blob => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
};

interface Transcription {
    text: string;
    author: 'user' | 'model';
    isFinal: boolean;
}

const Conversation: React.FC = () => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [status, setStatus] = useState('Idle');
    const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);

    // Fix: Infer the session promise type from the return type of `connectToLiveAPI` to avoid import errors.
    const sessionPromiseRef = useRef<ReturnType<typeof connectToLiveAPI> | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    const nextStartTimeRef = useRef(0);
    const audioSourcesRef = useRef(new Set<AudioBufferSourceNode>());

    const addOrUpdateTranscription = (author: 'user' | 'model', text: string, isFinal: boolean) => {
        setTranscriptions(prev => {
            const last = prev[prev.length - 1];
            if (last && last.author === author && !last.isFinal) {
                const newTranscriptions = [...prev];
                newTranscriptions[prev.length - 1] = { ...last, text: last.text + text };
                return newTranscriptions;
            }
            return [...prev, { author, text, isFinal }];
        });
    };
    
    const finalizeLastTranscription = (author: 'user' | 'model') => {
        setTranscriptions(prev => {
            const last = prev[prev.length - 1];
            if (last && last.author === author && !last.isFinal) {
                const newTranscriptions = [...prev];
                newTranscriptions[prev.length - 1] = { ...last, isFinal: true };
                return newTranscriptions;
            }
            return prev;
        });
    };

    const handleMessage = useCallback(async (message: LiveServerMessage) => {
        if (message.serverContent?.outputTranscription) {
            const text = message.serverContent.outputTranscription.text;
            addOrUpdateTranscription('model', text, false);
        } else if (message.serverContent?.inputTranscription) {
            const text = message.serverContent.inputTranscription.text;
            addOrUpdateTranscription('user', text, false);
        }

        if (message.serverContent?.turnComplete) {
            finalizeLastTranscription('user');
            finalizeLastTranscription('model');
        }
        
        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (base64Audio && outputAudioContextRef.current) {
            setStatus('Speaking...');
            const outputAudioContext = outputAudioContextRef.current;
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
            const source = outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputAudioContext.destination);
            source.addEventListener('ended', () => {
                audioSourcesRef.current.delete(source);
                if (audioSourcesRef.current.size === 0) {
                    setStatus('Listening...');
                }
            });
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += audioBuffer.duration;
            audioSourcesRef.current.add(source);
        }
        
        if(message.serverContent?.interrupted){
            for (const source of audioSourcesRef.current.values()) {
                source.stop();
                audioSourcesRef.current.delete(source);
            }
            nextStartTimeRef.current = 0;
            setStatus('Listening...');
        }

    }, []);

    const startSession = async () => {
        setTranscriptions([]);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            setIsSessionActive(true);
            setStatus('Connecting...');

            sessionPromiseRef.current = connectToLiveAPI({
                onopen: () => {
                    setStatus('Listening...');
                    if (!streamRef.current || !inputAudioContextRef.current) return;
                    
                    mediaStreamSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
                    scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                    
                    scriptProcessorRef.current.onaudioprocess = (event) => {
                        const inputData = event.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        if (sessionPromiseRef.current) {
                            sessionPromiseRef.current.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                        }
                    };
                    
                    mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                    scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
                },
                onmessage: handleMessage,
                onerror: (e) => {
                    console.error('Session error:', e);
                    setStatus('Error');
                    stopSession();
                },
                onclose: () => {
                    setStatus('Session Closed');
                    stopSession();
                },
            });

        } catch (error) {
            console.error('Failed to start session:', error);
            setStatus('Mic Error');
        }
    };
    
    const stopSession = useCallback(() => {
        if(sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close());
            sessionPromiseRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        
        if(scriptProcessorRef.current){
             scriptProcessorRef.current.disconnect();
             scriptProcessorRef.current = null;
        }
        if(mediaStreamSourceRef.current){
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        if(inputAudioContextRef.current){
            inputAudioContextRef.current.close();
            inputAudioContextRef.current = null;
        }
        if(outputAudioContextRef.current){
            outputAudioContextRef.current.close();
            outputAudioContextRef.current = null;
        }

        setIsSessionActive(false);
        setStatus('Idle');
    }, []);

    useEffect(() => {
        return () => {
           stopSession();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="flex flex-col h-full bg-gray-900 p-4">
            <div className="flex-grow flex flex-col bg-gray-800 rounded-lg p-4 overflow-y-auto space-y-4">
                {transcriptions.map((t, i) => (
                    <div key={i} className={`flex ${t.author === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <p className={`max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-lg ${t.author === 'user' ? 'bg-green-600' : 'bg-gray-700'}`}>
                            {t.text}
                        </p>
                    </div>
                ))}
                {transcriptions.length === 0 && (
                    <div className="flex-grow flex items-center justify-center text-gray-500">
                        <p>Press the mic button and start talking to your AI coach.</p>
                    </div>
                )}
            </div>
            <div className="flex-shrink-0 flex flex-col items-center justify-center pt-6">
                <button
                    onClick={isSessionActive ? stopSession : startSession}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${isSessionActive ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'}`}
                >
                    {isSessionActive ? <MicOffIcon className="w-10 h-10 text-white" /> : <MicIcon className="w-10 h-10 text-white" />}
                </button>
                <p className="mt-4 text-lg font-medium text-gray-300 capitalize">{status}</p>
            </div>
        </div>
    );
};

export default Conversation;