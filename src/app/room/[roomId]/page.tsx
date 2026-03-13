"use client";

import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Suspense, use } from "react";

const VideoRoom = dynamic(() => import("@/components/VideoRoom"), {
  ssr: false,
  loading: () => <div className="h-screen w-screen bg-slate-900 flex items-center justify-center text-white italic">Initializing Secure Video...</div>
});

function RoomContent({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const searchParams = useSearchParams();
  const userName = searchParams.get("userName") || "User_" + Math.floor(Math.random() * 1000);
  const role = (searchParams.get("role") as "doctor" | "patient") || "patient";

  return (
    <main>
      <VideoRoom 
        roomId={roomId} 
        userName={userName} 
        role={role} 
      />
    </main>
  );
}

export default function Page({ params }: { params: Promise<{ roomId: string }> }) {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-slate-900 flex items-center justify-center text-white">Loading Medical Suite...</div>}>
      <RoomContent params={params} />
    </Suspense>
  );
}
