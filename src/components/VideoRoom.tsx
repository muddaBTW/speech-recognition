"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Bell,
  FileText,
  Languages,
  LayoutDashboard,
  MessageSquare,
  Mic,
  MicOff,
  Settings,
  Stethoscope,
  User2,
  Video,
} from "lucide-react";

interface Message {
  id: string;
  senderName: string;
  senderRole?: "doctor" | "patient";
  sourceLanguage?: string;
  text: string;
  translatedText?: string;
  translatedLanguage?: string;
  isTranslating?: boolean;
  isPrescription?: boolean; // Flag to distinguish voice notes
  timestamp: number;
}

interface VideoRoomProps {
  roomId: string;
  userName: string;
  role: "doctor" | "patient";
}

const LANGUAGES = [
  { code: "hi-IN", name: "Hindi" },
  { code: "bn-IN", name: "Bengali" },
  { code: "ta-IN", name: "Tamil" },
  { code: "te-IN", name: "Telugu" },
  { code: "kn-IN", name: "Kannada" },
  { code: "gu-IN", name: "Gujarati" },
  { code: "mr-IN", name: "Marathi" },
  { code: "ml-IN", name: "Malayalam" },
  { code: "pa-IN", name: "Punjabi" },
];

const extractPayloadText = (msgObj: any): string | null => {
  if (!msgObj) return null;
  if (typeof msgObj === "string") return msgObj;
  if (typeof msgObj.message === "string") return msgObj.message;
  if (typeof msgObj.text === "string") return msgObj.text;
  if (typeof msgObj.content === "string") return msgObj.content;
  if (typeof msgObj.msg === "string") return msgObj.msg;
  return null;
};

const isSecureWebRtcOrigin = () => {
  if (typeof window === "undefined") return true;

  const host = window.location.hostname;
  const isLocalhost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1";

  return window.isSecureContext || isLocalhost;
};

export default function VideoRoom({ roomId, userName, role }: VideoRoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribeStatus, setTranscribeStatus] = useState<"idle" | "listening" | "error">("idle");
  const [tempTranscript, setTempTranscript] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [targetLang, setTargetLang] = useState("hi-IN");
  
  const recognitionRef = useRef<any>(null);
  const recognitionRestartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualStopRef = useRef(false);
  const lastSpeechErrorRef = useRef<string | null>(null);
  const zegoInstanceRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const targetLangRef = useRef("hi-IN"); // Critical for stale closure fix
  
  const [isJoined, setIsJoined] = useState(false);
  const joiningRef = useRef(false);

  // Sync refs with state for reliable callback access
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { targetLangRef.current = targetLang; }, [targetLang]);

  const getDesiredDisplayLanguage = useCallback(() => {
    return targetLangRef.current;
  }, []);

  // Translation Function (for Patient)
  const translateMessage = async (msgId: string, text: string, requestedLanguage: string) => {
    const currentMsgs = messagesRef.current;
    const msg = currentMsgs.find(m => m.id === msgId);

    if (!msg) {
      return;
    }

    if (
      msg &&
      msg.translatedText &&
      msg.translatedLanguage === requestedLanguage &&
      !msg.isTranslating
    ) {
      return;
    }

    setMessages(prev => prev.map(m => (
      m.id === msgId
        ? {
            ...m,
            isTranslating: true,
            translatedText: m.translatedLanguage === requestedLanguage ? m.translatedText : undefined,
            translatedLanguage: m.translatedLanguage === requestedLanguage ? m.translatedLanguage : undefined,
          }
        : m
    )));
    try {
      console.log(`TeleHealth: Translating to ${requestedLanguage}:`, text.substring(0, 20) + "...");
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLanguage: requestedLanguage }),
      });
      const data = await res.json();
      if (data.translated_text) {
        setMessages((prev) =>
          prev.map((m) => (
            m.id === msgId
              ? {
                  ...m,
                  translatedText: data.translated_text,
                  translatedLanguage: requestedLanguage,
                  isTranslating: false,
                }
              : m
          ))
        );
      } else {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isTranslating: false } : m));
      }
    } catch (error) {
      console.error("Translation fail", error);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isTranslating: false } : m));
    }
  };

  const handleIncomingPrescription = useCallback((rawMessage: any) => {
    const payload = extractPayloadText(rawMessage);
    const commandPayload = rawMessage && typeof rawMessage.command === "object" ? rawMessage.command : null;

    try {
      const parsed = (commandPayload ?? JSON.parse(payload ?? "")) as Message;
      if (!parsed?.id || !parsed?.text || !parsed?.senderName) return;
      if (!parsed.isPrescription) {
        console.log("TeleHealth: [CHAT] Ignoring non-prescription JSON message");
        return;
      }

      setMessages((prev) => {
        const existing = prev.find((m) => m.id === parsed.id);
        if (existing) {
          return prev;
        }
        return [...prev, parsed];
      });
    } catch (error) {
      console.log("TeleHealth: [CHAT] Ignoring non-JSON/manual message");
    }
  }, [role]);

  // Handle Incoming Messages - supports both room chat and signaling text callbacks
  const handleInRoomMessageReceived = useCallback((messageConfig: any) => {
    console.log("TeleHealth: [RECEIVE] Raw Data:", messageConfig);
    const normalized = Array.isArray(messageConfig) ? messageConfig : [messageConfig];
    normalized.forEach(handleIncomingPrescription);
  }, [handleIncomingPrescription]); 

  const sendMessage = useCallback((text: string, isPrescription: boolean = true) => {
    const instance = zegoInstanceRef.current;
    if (!instance || !text.trim()) return;

    const msgData: Message = {
      id: "th-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
      senderName: userName,
      senderRole: role,
      sourceLanguage: role === "doctor" ? "en-IN" : targetLangRef.current,
      text: text,
      timestamp: Date.now(),
      isPrescription: isPrescription
    };

    const payload = JSON.stringify(msgData);
    console.log("TeleHealth: [SEND] Payload:", payload);

    try {
      let dispatched = false;
      console.log("TeleHealth: [SEND] Available APIs:", {
        sendInRoomCustomCommand: typeof instance.sendInRoomCustomCommand,
        sendInRoomCommand: typeof instance.sendInRoomCommand,
        sendInRoomMessage: typeof instance.sendInRoomMessage,
        express: !!instance.express,
        expressSendInRoomTextMessage: typeof instance.express?.sendInRoomTextMessage,
        expressSendBroadcastMessage: typeof instance.express?.sendBroadcastMessage,
        expressSendBarrageMessage: typeof instance.express?.sendBarrageMessage,
      });
      console.log("TeleHealth: [SEND] Prototype APIs:", Object.getOwnPropertyNames(Object.getPrototypeOf(instance) || {}));
      if (instance.express) {
        console.log("TeleHealth: [SEND] Express prototype APIs:", Object.getOwnPropertyNames(Object.getPrototypeOf(instance.express) || {}));
      }

      // Prefer RTC-backed room messaging. ZIM-backed methods exist on the instance,
      // but they throw at runtime unless the ZIM plugin is installed.
      if (typeof instance.sendInRoomMessage === "function") {
        instance.sendInRoomMessage(payload);
        dispatched = true;
        console.log("TeleHealth: [SEND] Dispatched via sendInRoomMessage");
      } else if (instance.express && typeof instance.express.sendBroadcastMessage === "function") {
        instance.express.sendBroadcastMessage(roomId, payload);
        dispatched = true;
        console.log("TeleHealth: [SEND] Dispatched via Express sendBroadcastMessage");
      } else if (instance.express && typeof instance.express.sendInRoomTextMessage === "function") {
        instance.express.sendInRoomTextMessage(roomId, payload);
        dispatched = true;
        console.log("TeleHealth: [SEND] Dispatched via Express Engine text message");
      } else if (instance.express && typeof instance.express.sendBarrageMessage === "function") {
        instance.express.sendBarrageMessage(roomId, payload);
        dispatched = true;
        console.log("TeleHealth: [SEND] Dispatched via Express sendBarrageMessage");
      }

      if (!dispatched) {
        console.error("TeleHealth: [SEND] No supported Zego message API found");
        return;
      }
      
      setMessages((prev) => [...prev, msgData]);
    } catch (err) {
      console.error("TeleHealth: [SEND] CRITICAL ERROR:", err);
    }
  }, [userName, roomId]);

  // Initialize Speech Recognition for both doctor and patient.
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = role === "doctor" ? "en-IN" : targetLangRef.current;

        recognition.onstart = () => {
          console.log("TeleHealth: [SPEECH] Mic Started");
          lastSpeechErrorRef.current = null;
          setTranscribeStatus("listening");
        };

        recognition.onresult = (event: any) => {
          let interimText = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result && result[0]) {
              if (result.isFinal) {
                sendMessage(result[0].transcript);
                setTempTranscript("");
              } else {
                interimText += result[0].transcript;
              }
            }
          }
          setTempTranscript(interimText);
        };

        recognition.onerror = (event: any) => {
          lastSpeechErrorRef.current = event.error;

          if (event.error === "no-speech") {
            return;
          }

          if (event.error === "aborted") {
            console.warn("TeleHealth: [SPEECH] Aborted");
            return;
          }

          console.error("TeleHealth: [SPEECH] Error:", event.error);
          setTranscribeStatus("error");
        };

        recognition.onend = () => {
          console.log("TeleHealth: [SPEECH] Ended");

          if (manualStopRef.current) {
            manualStopRef.current = false;
            lastSpeechErrorRef.current = null;
            setTranscribeStatus("idle");
            return;
          }

          if (lastSpeechErrorRef.current === "aborted") {
            setIsRecording(false);
            setTranscribeStatus("idle");
            return;
          }

          if (isRecordingRef.current) {
            console.log("TeleHealth: [SPEECH] Service closed. Auto-restarting...");
            recognitionRestartTimeoutRef.current = setTimeout(() => {
              if (isRecordingRef.current) {
                try { recognition.start(); } catch (e) {
                   console.error("TeleHealth: [SPEECH] Restart blocked:", e);
                }
              }
            }, 300);
          } else {
            setTranscribeStatus("idle");
          }
        };

        recognitionRef.current = recognition;
      }
    }
    return () => {
      if (recognitionRestartTimeoutRef.current) {
        clearTimeout(recognitionRestartTimeoutRef.current);
        recognitionRestartTimeoutRef.current = null;
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.onstart = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch {}
      }

      recognitionRef.current = null;
    };
  }, [role, sendMessage]);

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = role === "doctor" ? "en-IN" : targetLang;
    }
  }, [role, targetLang]);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use Chrome.");
      return;
    }
    
    if (isRecording) {
      manualStopRef.current = true;
      setIsRecording(false);
      recognitionRef.current.stop();
    } else {
      lastSpeechErrorRef.current = null;
      setIsRecording(true);
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("TeleHealth: Activation failed", e);
        setIsRecording(false);
      }
    }
  };
  
  // Auto-translate incoming voice notes into the local user's reading language.
  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    const desiredLanguage = getDesiredDisplayLanguage();

    messages.forEach((message) => {
      const sourceLanguage = message.sourceLanguage ?? (message.senderRole === "doctor" ? "en-IN" : targetLang);
      const isIncomingVoiceNote = message.isPrescription && message.senderRole !== role;
      const needsTranslation =
        isIncomingVoiceNote &&
        !message.isTranslating &&
        (!!message.text?.trim()) &&
        sourceLanguage !== desiredLanguage &&
        (
          !message.translatedText ||
          message.translatedLanguage !== desiredLanguage
        );

      if (needsTranslation) {
        console.log("TeleHealth: Auto-translating prescription:", message.id, "->", desiredLanguage);
        void translateMessage(message.id, message.text, desiredLanguage);
      }
    });
  }, [getDesiredDisplayLanguage, messages, role, targetLang]);

  const initZego = async () => {
    if (joiningRef.current || isJoined) return;

    if (!isSecureWebRtcOrigin()) {
      alert("WebRTC requires HTTPS or localhost. Open this app on https:// or on http://localhost.");
      console.error("TeleHealth: WebRTC requires HTTPS or localhost");
      return;
    }
    
    const appID = Number(process.env.NEXT_PUBLIC_ZEGOCLOUD_APP_ID);
    const serverSecret = process.env.NEXT_PUBLIC_ZEGOCLOUD_SERVER_SECRET as string;
    
    if (!appID || !serverSecret || !containerRef.current || !roomId || !userName) {
      console.warn("TeleHealth: Missing required parameters to join room.");
      return;
    }

    try {
      joiningRef.current = true;
      const { ZegoUIKitPrebuilt } = await import("@zegocloud/zego-uikit-prebuilt");

      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        appID,
        serverSecret,
        roomId,
        Date.now().toString(),
        userName
      );

      const zp = ZegoUIKitPrebuilt.create(kitToken);
      zegoInstanceRef.current = zp;
      console.log("TeleHealth: Zego Instance Created:", Object.keys(zp));

      await zp.joinRoom({
        container: containerRef.current,
        sharedLinks: [{ name: "Room Link", url: window.location.origin + window.location.pathname }],
        scenario: { mode: ZegoUIKitPrebuilt.OneONoneCall },
        sendMessageChannel: "RTC",
        showScreenSharingButton: false,
        showMyCameraToggleButton: true,
        showMyMicrophoneToggleButton: true,
        showAudioVideoSettingsButton: true,
        turnOnCameraWhenJoining: true,
        turnOnMicrophoneWhenJoining: true,
        showPreJoinView: false,
        onInRoomMessageReceived: handleInRoomMessageReceived,
        onInRoomTextMessageReceived: handleInRoomMessageReceived,
      });

      console.log("TeleHealth: Room Joined Successfully");
      setIsJoined(true);
      joiningRef.current = false;
    } catch (error) {
      console.error("Zego Initialization Error:", error);
      joiningRef.current = false;
    }
  };

  useEffect(() => {
    return () => {
      if (zegoInstanceRef.current) {
        zegoInstanceRef.current.destroy();
        zegoInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white font-sans overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-slate-800 border-b border-slate-700 shadow-lg z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <User2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">Tele-Health Call</h1>
            <div className="flex items-center gap-2">
               <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{role}</span>
               <span className="text-slate-600">•</span>
               <span className="text-[10px] text-blue-400 font-mono font-bold tracking-tighter">ID: {roomId}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const url = window.location.origin + window.location.pathname.replace(`/${roomId}`, `/${roomId}`);
              if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(url);
                alert("Room link copied! Send this to the other person.");
                return;
              }

              const textArea = document.createElement("textarea");
              textArea.value = url;
              textArea.setAttribute("readonly", "");
              textArea.style.position = "absolute";
              textArea.style.left = "-9999px";
              document.body.appendChild(textArea);
              textArea.select();
              document.execCommand("copy");
              document.body.removeChild(textArea);
              alert("Room link copied! Send this to the other person.");
            }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-white/5 active:scale-95"
          >
            Copy Invite Link
          </button>

          {!isJoined && (
            <button
              onClick={initZego}
              className="bg-blue-600 hover:bg-blue-500 px-8 py-2.5 rounded-full font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all text-sm flex items-center gap-2 border border-blue-400/30"
            >
              <Video size={18} />
              Start Consultation
            </button>
          )}

          {isJoined && (
            <button
              onClick={toggleRecording}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-bold transition-all shadow-lg active:scale-95 ${
                isRecording 
                  ? "bg-red-500 hover:bg-red-600 shadow-red-500/20 animate-pulse" 
                  : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
              }`}
            >
              {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
              {isRecording ? "Stop Voice" : role === "doctor" ? "Prescribe by Voice" : "Speak to Doctor"}
            </button>
          )}

          {isJoined && (
            <div className="flex items-center gap-2 bg-slate-700/50 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10">
              <Languages size={16} className="text-blue-400" />
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="bg-transparent text-xs font-bold focus:outline-none cursor-pointer"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-slate-800">
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Video Area Container */}
        <div className="flex-[3] bg-black relative shadow-inner overflow-hidden border-r border-slate-700/50">
          {/* THE ZEGO CONTAINER - STABLE IN DOM */}
          <div ref={containerRef} className="w-full h-full z-0" />

          {/* Static Overlay when not joined */}
          {!isJoined && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm">
                <div className="text-center p-8 max-w-sm">
                  <div className="w-24 h-24 bg-blue-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-blue-500/20 rotate-12 transition-transform hover:rotate-0">
                    <Video className="text-blue-500 w-12 h-12" />
                  </div>
                  <h3 className="text-2xl font-black mb-3">Secure Medical Room</h3>
                  <p className="text-slate-400 text-sm mb-8 leading-relaxed">Ensure your microphone is connected. Your privacy is protected by end-to-end encryption.</p>
                  <div className="animate-bounce">
                     <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">Click Start Consultation Above</p>
                  </div>
                </div>
            </div>
          )}
        </div>

        {/* Chat / Transcription Sidebar */}
        <div className="w-96 bg-slate-800/80 backdrop-blur-md flex flex-col border-l border-white/5">
          <div className="p-5 border-b border-white/5 flex items-center justify-between bg-slate-900/40">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <MessageSquare size={16} className="text-indigo-400" />
               </div>
               <h2 className="font-bold text-sm uppercase tracking-wider text-slate-300">Prescription Log</h2>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar bg-slate-900/20">
            {messages.length === 0 && !tempTranscript && (
              <div className="h-full flex flex-col items-center justify-center text-slate-500/50 text-center px-6">
                <div className="w-20 h-20 rounded-3xl bg-slate-800/40 flex items-center justify-center mb-6 border border-white/5">
                   <Mic size={32} strokeWidth={1} className="text-slate-600" />
                </div>
                <h4 className="text-slate-300 font-bold mb-2 uppercase tracking-wide text-xs">Awaiting Audio</h4>
                <p className="text-xs leading-relaxed">Medical notes will be generated automatically as the doctor speaks.</p>
              </div>
            )}
            
            {tempTranscript && isJoined && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Capturing Live...</span>
                  </div>
                  <button 
                    onClick={() => {
                      sendMessage(tempTranscript);
                      setTempTranscript("");
                    }}
                    className="text-[10px] font-bold text-white bg-blue-600 px-2 py-0.5 rounded-md hover:bg-blue-500 transition-colors uppercase tracking-tighter"
                  >
                    Send Now
                  </button>
                </div>
                <p className="text-sm text-slate-300 italic">"{tempTranscript}"</p>
              </div>
            )}
            
            {transcribeStatus === "listening" && !tempTranscript && isJoined && (
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-xl border border-white/5 animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Microphone Active - Speak now</span>
              </div>
            )}

            {transcribeStatus === "error" && isJoined && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 rounded-xl border border-red-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest leading-none">Microphone Error - Check permissions</span>
              </div>
            )}
            
            {messages.filter(m => m.isPrescription).map((msg) => {
              return (
                <div key={msg.id} className="relative group animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="absolute -left-2 top-0 bottom-0 w-1 bg-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                  
                  <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-all shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                       <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{msg.senderName}</span>
                          <span className="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-[8px] font-black text-blue-400 uppercase tracking-tighter border border-blue-500/20">Prescription</span>
                       </div>
                       <span className="text-[10px] font-medium text-slate-600">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    
                    {/* Primary Display: show translated incoming notes for the local user */}
                    <p className="text-sm text-slate-200 leading-relaxed font-medium">
                       {msg.senderRole !== role && msg.translatedText ? msg.translatedText : msg.text}
                    </p>

                    {msg.senderRole !== role && msg.translatedText && (
                      <p className="mt-2 text-[10px] text-slate-500 italic leading-relaxed">
                        Original: {msg.text}
                      </p>
                    )}
                    
                    {msg.isTranslating && (
                      <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 animate-pulse">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mr-1" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Translating to {LANGUAGES.find(l => l.code === targetLang)?.name}...</span>
                      </div>
                    )}

                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 20px;
        }
      `}</style>
    </div>
  );
}
