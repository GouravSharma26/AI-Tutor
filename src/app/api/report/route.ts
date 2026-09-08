import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ 
        report: "You haven't set up the Groq API key, so a session report could not be generated." 
      });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // Format transcript
    let transcriptText = '';
    messages.forEach((msg: any) => {
      const role = msg.role === 'user' ? 'Student' : 'Tutor';
      transcriptText += `${role}: ${msg.content}\n`;
    });

    const prompt = `You are an expert English language evaluator. Please read the following transcript of an English tutoring session and generate a concise, encouraging performance report for the student.

Transcript:
${transcriptText}

Please structure your report beautifully using Markdown. Use H3 tags for sections, bullet points, and bold text for emphasis.
### 📊 Overall Fluency
(A short paragraph about their fluency)

### ✨ Grammar Feedback
(Highlight any specific grammar mistakes and how they improved or should improve)

### 📚 Vocabulary Suggestion
(Suggest 1 or 2 new words they could have used in this conversation)

### 🌟 Encouragement
(A short encouraging closing statement)`;

    const response = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'groq/compound-mini',
      temperature: 0.5,
    });

    return NextResponse.json({ report: response.choices[0]?.message?.content || "No report generated." });
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
