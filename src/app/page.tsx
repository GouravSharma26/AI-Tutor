import Conversation from '@/components/Conversation';

export const metadata = {
  title: 'AI English Tutor',
  description: 'Practice English with an AI voice tutor',
};

export default function Home() {
  return (
    <main>
      <Conversation />
    </main>
  );
}
