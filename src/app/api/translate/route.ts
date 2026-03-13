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
      input: text,
      source_language_code: "en-IN",
      target_language_code: targetLanguage,
      model: "sarvam-translate:v1",
    };

    const response = await fetch(
      "https://api.sarvam.ai/translate",
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
        console.error("Sarvam API Error:", errorText);
        return NextResponse.json(
            { error: `Sarvam API returned error: ${response.status} - ${errorText}` },
            { status: response.status }
        );
    }

    const data = await response.json();
    return NextResponse.json({ translated_text: data.translated_text });
  } catch (error) {
    console.error("Translation API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
