"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Stethoscope, User, Video, Languages, Mic, Volume2 } from "lucide-react";

export default function Home() {
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const router = useRouter();

  const joinRoom = (role: "doctor" | "patient") => {
    if (!roomId || !userName) {
      alert("Please enter Room ID and Your Name");
      return;
    }
    router.push(`/room/${roomId}?role=${role}&userName=${userName}`);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white selection:bg-blue-500/30">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
      </div>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-20 flex flex-col items-center">
        {/* Hero Section */}
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-4">
            <Video size={14} /> Real-time Indian Language Telemedicine
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
            Connect Beyond <br /> <span className="text-blue-500">Language Barriers</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            A premium video consultation suite powered by Sarvam AI. Transcribe doctor’s advice, translate into 9+ Indian languages, and play audio for rural patients.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-20 w-full max-w-4xl">
           <FeatureCard 
             icon={<Mic className="text-blue-500" />} 
             title="Auto-Transcription" 
             desc="Doctor's speech transforms into live text in the patient's chat box."
           />
           <FeatureCard 
             icon={<Languages className="text-indigo-500" />} 
             title="Local Translation" 
             desc="One-click translation to Hindi, Marathi, Tamil, Telugu, and more."
           />
           <FeatureCard 
             icon={<Volume2 className="text-cyan-500" />} 
             title="Text-to-Speech" 
             desc="High-quality AI voices read messages out loud for easy understanding."
           />
        </div>

        {/* Entry Form */}
        <div className="w-full max-w-md bg-slate-800/40 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 ml-1">Consultation Room ID</label>
              <input
                type="text"
                placeholder="e.g. clinic-101"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-600"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 ml-1">Your Name</label>
              <input
                type="text"
                placeholder="Enter your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <button
                onClick={() => joinRoom("doctor")}
                className="group flex flex-col items-center gap-3 p-4 rounded-2xl bg-blue-600 hover:bg-blue-500 transition-all active:scale-95 shadow-lg shadow-blue-500/20"
              >
                <Stethoscope size={24} className="group-hover:scale-110 transition-transform" />
                <span className="font-bold text-sm">Join as Doctor</span>
              </button>

              <button
                onClick={() => joinRoom("patient")}
                className="group flex flex-col items-center gap-3 p-4 rounded-2xl bg-slate-700 hover:bg-slate-600 transition-all active:scale-95 border border-white/5"
              >
                <User size={24} className="group-hover:scale-110 transition-transform" />
                <span className="font-bold text-sm">Join as Patient</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-20 text-slate-500 text-sm">
          Built with <span className="text-blue-500">Sarvam AI</span> & <span className="text-indigo-500">ZegoCloud</span>
        </footer>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all hover:bg-white/10">
      <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center mb-4 border border-white/5">
        {icon}
      </div>
      <h3 className="font-bold mb-2">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}
