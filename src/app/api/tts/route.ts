import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { text, targetLanguage } = await request.json();

    if (!text || !targetLanguage) {
      return NextResponse.json(
        { error: "Text and Target Language are required" },
        { status: 400 }
      );
    }

    const payload = {
      inputs: [text],
      target_language_code: targetLanguage, // e.g. "hi-IN"
      speaker: "meera", // Sarvam's standard female TTS voice
      pitch: 0,
      pace: 1.0,
      loudness: 1.5,
      speech_sample_rate: 8000,
      enable_preprocessing: true,
      model: "bulbul:v1",
    };

    const response = await fetch(
      "https://api.sarvam.ai/text-to-speech",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": process.env.SARVAM_API_KEY as string,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Sarvam TTS API Error:", errorText);
        return NextResponse.json(
            { error: `Sarvam TTS API returned error: ${response.status} - ${errorText}` },
            { status: response.status }
        );
    }

    const data = await response.json();
    return NextResponse.json({ audios: data.audios });
  } catch (error) {
    console.error("TTS API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
