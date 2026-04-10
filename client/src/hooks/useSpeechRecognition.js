"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Robust Speech Recognition Hook
 * Fixes the "repeating words" issue by rebuilding the session transcript from the results list
 * and maintaining a base transcript across restarts.
 */
export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");

  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  
  // baseTranscriptRef holds text from PREVIOUS closed sessions
  const baseTranscriptRef = useRef("");
  // currentSessionFinalRef holds final text from the CURRENT active session
  const currentSessionFinalRef = useRef("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const isAndroid = /Android/i.test(navigator.userAgent);
    const recognition = new SpeechRecognition();
    
    // On Android, continuous=true is often buggy and repeats words. 
    // We set it to false and handle restarts manually in onend for better reliability.
    recognition.continuous = !isAndroid;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    recognition.onresult = (event) => {
      let sessionFinal = "";
      let sessionInterim = "";

      // Rebuild the entire session transcript from the results object.
      // This is more robust than using event.resultIndex and appending, 
      // which often leads to duplicate words in some browsers.
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        
        if (result.isFinal) {
          // Add a space if needed between results
          if (sessionFinal && !sessionFinal.endsWith(" ") && !text.startsWith(" ")) {
            sessionFinal += " ";
          }
          sessionFinal += text;
        } else {
          sessionInterim += text;
        }
      }

      currentSessionFinalRef.current = sessionFinal;
      
      // The total transcript is whatever we had before + what we just finalized
      const totalFinal = (baseTranscriptRef.current + " " + sessionFinal).trim();
      setTranscript(totalFinal);
      setInterimTranscript(sessionInterim);
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return; // Ignore silent timeouts
      console.error("Speech recognition error", event.error);
    };

    recognition.onend = () => {
      // Session ended. Commit the current session's final text to the base.
      if (currentSessionFinalRef.current) {
        const newBase = (baseTranscriptRef.current + " " + currentSessionFinalRef.current).trim();
        baseTranscriptRef.current = newBase;
        currentSessionFinalRef.current = "";
      }

      if (isListeningRef.current) {
        try {
          recognition.start();
        } catch (e) {
          console.error("Failed to restart speech recognition", e);
          setIsListening(false);
          isListeningRef.current = false;
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onend = null;
      recognition.stop();
    };
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      baseTranscriptRef.current = "";
      currentSessionFinalRef.current = "";
      setTranscript("");
      setInterimTranscript("");
      isListeningRef.current = true;
      setIsListening(true);
      recognitionRef.current.start();
    } catch (e) {
      console.error("Speech recognition start error", e);
    }
  }, []);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const resetTranscript = useCallback(() => {
    baseTranscriptRef.current = "";
    currentSessionFinalRef.current = "";
    setTranscript("");
    setInterimTranscript("");
  }, []);

  return {
    transcript,
    interimTranscript,
    listening: isListening,
    browserSupportsSpeechRecognition: isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
}
