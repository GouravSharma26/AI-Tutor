'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Sparkles, BookOpen, Volume2, Bot, Settings, RotateCcw, XCircle, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import styles from './Conversation.module.css';

interface Message {
  role: 'user' | 'ai';
  content: string;
  correction?: string;
}

export default function Conversation() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', content: "Hello! Let's practice. Tell me about your day." }
  ]);
  
  const [sessionReport, setSessionReport] = useState<string | null>(null);
  const [sessionTime, setSessionTime] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [showNameModal, setShowNameModal] = useState<boolean>(false);
  const [nameInput, setNameInput] = useState('');
  const [showMobileSidebar, setShowMobileSidebar] = useState<boolean>(false);
  
  // Dynamic stats
  const [stats, setStats] = useState({ grammar: 0, vocabulary: 0, speaking: 0 });
  const [weeklyData, setWeeklyData] = useState([0, 0, 0, 0, 0]);

  // Modal States
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [speechRate, setSpeechRate] = useState<number>(1.0);

  const recognitionRef = useRef<any>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const isActiveSessionRef = useRef<boolean>(true);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const waveRefs = useRef<(HTMLDivElement | null)[]>([]);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const lastActiveTimeRef = useRef<number>(Date.now());
  const messagesRef = useRef<Message[]>(messages);

  // Load stats from Local Storage on mount
  useEffect(() => {
    setIsMounted(true);
    
    const storedName = localStorage.getItem('tuitor-username');
    if (storedName) {
      setUserName(storedName);
      setMessages([{ role: 'ai', content: `Hello, ${storedName}! Let's practice. Tell me about your day.` }]);
    } else {
      setShowNameModal(true);
    }

    const savedStats = localStorage.getItem('tuitor-stats');
    if (savedStats) {
      try { setStats(JSON.parse(savedStats)); } catch (e) {}
    }
    const savedWeekly = localStorage.getItem('tuitor-weekly');
    if (savedWeekly) {
      try { setWeeklyData(JSON.parse(savedWeekly)); } catch (e) {}
    }
  }, []);

  // Save stats to Local Storage when they change
  useEffect(() => {
    localStorage.setItem('tuitor-stats', JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem('tuitor-weekly', JSON.stringify(weeklyData));
  }, [weeklyData]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Auto scroll to bottom without pushing window
  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTo({
        top: chatAreaRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, transcript]);

  // Session Timer & Inactivity
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActiveSessionRef.current) {
      interval = setInterval(() => {
        if (isListening || isSpeaking || isProcessing) {
          setSessionTime(prev => prev + 1);
        }

        // Inactivity Check (2 minutes = 120000ms)
        if (isActiveSessionRef.current && isListening && !isSpeaking && !isProcessing) {
          if (Date.now() - lastActiveTimeRef.current > 120000) {
            handleEndSession();
          }
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isListening, isSpeaking, isProcessing]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Fetch voices for settings
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
        setAvailableVoices(voices);
        if (voices.length > 0 && !selectedVoiceURI) {
          const pref = voices.find(v => v.name.includes('Natural') || v.name.includes('Google US English') || v.name.includes('Samantha'));
          setSelectedVoiceURI(pref ? pref.voiceURI : voices[0].voiceURI);
        }
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedVoiceURI]);

  // High-performance DOM waveform animation
  useEffect(() => {
    let animationFrame: number;
    let time = 0;
    
    const updateWaveform = () => {
      time += 0.15;
      
      waveRefs.current.forEach((el, i) => {
        if (!el) return;
        
        if (!isListening && !isSpeaking) {
           // Flatline breathing effect when idle
           el.style.height = `${Math.max(2, 5 + Math.sin(time + i * 0.2) * 2)}%`;
           return;
        }
        
        // Active dynamic waveform
        const centerOffset = Math.abs(i - 27) / 27;
        const envelope = Math.pow(1 - centerOffset, 1.2); // Bell curve shape
        
        const wave1 = Math.sin(time * 2 + i * 0.5);
        const wave2 = Math.sin(time * 3.5 - i * 0.2);
        const noise = Math.random() * 0.5;
        
        const baseHeight = envelope * 50;
        const dynamicPart = (wave1 * 0.5 + wave2 * 0.5 + noise) * 50 * envelope;
        
        el.style.height = `${Math.max(4, Math.min(100, baseHeight + dynamicPart + 10))}%`;
      });
      
      animationFrame = requestAnimationFrame(updateWaveform);
    };
    
    animationFrame = requestAnimationFrame(updateWaveform);
    return () => cancelAnimationFrame(animationFrame);
  }, [isListening, isSpeaking]);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        lastActiveTimeRef.current = Date.now();
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          fullTranscript += event.results[i][0].transcript;
        }
        setTranscript(fullTranscript);

        // Reset the 5-second silence timer every time they speak
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          // If 5 seconds of silence passes, stop recognition (which triggers onend and sends the message)
          if (recognitionRef.current) {
            recognitionRef.current.stop();
          }
        }, 5000);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          alert('Microphone access was denied. Please allow microphone access to use Tuitor AI.');
          setIsListening(false);
          isActiveSessionRef.current = false;
        } else if (event.error === 'network') {
          // Attempt to restart on network drop
          setTimeout(() => {
            if (isActiveSessionRef.current && !isPlayingRef.current) {
              try { recognitionRef.current.start(); } catch(e){}
            }
          }, 1000);
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        setTranscript((current) => {
          if (current.trim()) {
            handleUserMessage(current.trim());
          }
          return '';
        });
      };
    }
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      recognitionRef.current?.stop();
      stopAudio();
    };
  }, []);

  const stopAudio = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsSpeaking(false);
  };

  const handleAudioEnd = () => {
    isPlayingRef.current = false;
    if (audioQueueRef.current.length === 0) {
      setIsSpeaking(false);
      if (isActiveSessionRef.current && !isProcessingRef.current) {
        setTimeout(() => {
          try {
            setTranscript('');
            recognitionRef.current?.start();
            setIsListening(true);
          } catch (e) {}
        }, 300); 
      }
    } else {
      playNextAudio();
    }
  };

  const playNextAudio = async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    
    isPlayingRef.current = true;
    setIsSpeaking(true);
    const textToSpeak = audioQueueRef.current.shift();

    if (textToSpeak && typeof window !== 'undefined' && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'en-US';
      utterance.rate = speechRate;
      
      const voices = window.speechSynthesis.getVoices();
      const chosenVoice = voices.find(v => v.voiceURI === selectedVoiceURI);
      if (chosenVoice) {
        utterance.voice = chosenVoice;
      }

      utterance.onend = () => {
        handleAudioEnd();
      };

      utterance.onerror = (e) => {
        console.error("SpeechSynthesis error:", e);
        handleAudioEnd();
      };

      window.speechSynthesis.speak(utterance);
    } else {
      handleAudioEnd();
    }
  };

  const handleUserMessage = async (text: string) => {
    if (isProcessingRef.current || !isActiveSessionRef.current) return;
    lastActiveTimeRef.current = Date.now();
    isProcessingRef.current = true;
    setIsProcessing(true);
    
    const currentMessages = messagesRef.current;
    const newMessages: Message[] = [...currentMessages, { role: 'user', content: text }];
    setMessages(newMessages);

    // Make stats interactive based on speech
    setStats(s => ({ ...s, speaking: Math.min(100, s.speaking + 1) }));
    setWeeklyData(prev => {
      const nw = [...prev];
      nw[4] = Math.min(100, nw[4] + 2); // Increase today's bar
      return nw;
    });

    const uniqueWords = new Set(text.toLowerCase().split(/\s+/)).size;
    if (uniqueWords > 5) {
      setStats(s => ({ ...s, vocabulary: Math.min(100, s.vocabulary + 1) }));
    }

    try {
      const currentUserName = localStorage.getItem('tuitor-username') || 'the user';
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, userName: currentUserName }),
      });

      if (!response.ok || !response.body) throw new Error('API request failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      let fullBuffer = '';
      let processedLength = 0;
      let displayContent = '';
      let hasDeducted = false;
      
      setMessages((prev) => [...prev, { role: 'ai', content: '' }]);
      setIsProcessing(false); 

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullBuffer += chunk;
        displayContent = fullBuffer;
        let correction = undefined;

        const correctionMatch = fullBuffer.match(/^\[CORRECT:\s*(.*?)\]\s*/i);
        if (correctionMatch) {
          correction = correctionMatch[1];
          displayContent = fullBuffer.substring(correctionMatch[0].length);
          
          if (!hasDeducted) {
             setStats(s => ({ ...s, grammar: Math.max(0, s.grammar - 2) }));
             hasDeducted = true;
          }
        } else if (!correctionMatch && fullBuffer.length > 20 && !hasDeducted) {
          // If no correction was found in a decent sized message, reward them
          setStats(s => ({ ...s, grammar: Math.min(100, s.grammar + 1) }));
          hasDeducted = true; // Use this flag just to run once per message
        }

        setMessages((prev) => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1].content = displayContent;
          if (correction) newMsgs[newMsgs.length - 1].correction = correction;
          return newMsgs;
        });

        const unplayedContent = displayContent.substring(processedLength);
        const sentenceRegex = /([^.?!]+[.?!]+[\s\n]*)/g;
        let matchResult;
        const sentences = [];

        while ((matchResult = sentenceRegex.exec(unplayedContent)) !== null) {
          sentences.push(matchResult[0]);
          processedLength += matchResult[0].length;
        }

        if (sentences.length > 0) {
          sentences.forEach(s => {
            const cleanSentence = s.trim();
            if (cleanSentence) {
              audioQueueRef.current.push(cleanSentence);
              playNextAudio();
            }
          });
        }
      }

      const remaining = displayContent.substring(processedLength).trim();
      if (remaining) {
        audioQueueRef.current.push(remaining);
        playNextAudio();
      }

    } catch (error) {
      console.error('Error in chat processing:', error);
      setIsProcessing(false);
      isProcessingRef.current = false;
      setMessages((prev) => [...prev, { role: 'ai', content: "Sorry, I hit a server error or quota limit. Let's try that again!" }]);
      // We will also speak this out loud so the loop doesn't break
      audioQueueRef.current.push("Sorry, I hit a server error. Let's try that again.");
      playNextAudio();
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
      if (audioQueueRef.current.length === 0 && !isPlayingRef.current && isActiveSessionRef.current) {
         try {
           recognitionRef.current?.start();
           setIsListening(true);
         } catch(e){}
      }
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      stopAudio();
      try {
        setTranscript('');
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {}
    }
  };

  const handleEndSession = async () => {
    if (isListening) toggleListening();
    stopAudio();
    isActiveSessionRef.current = false;
    setIsProcessing(true);
    
    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messagesRef.current }),
      });
      const data = await response.json();
      if (data.report) {
        setSessionReport(data.report);
        setShowReportModal(true);
      }
    } catch (e) {
      console.error(e);
      setSessionReport("Failed to generate report.");
      setShowReportModal(true);
    } finally {
      setIsProcessing(false);
      
      // Update Daily Stats to simulate session completion progress
      setStats(s => ({
        grammar: Math.min(100, s.grammar + 2),
        vocabulary: Math.min(100, s.vocabulary + 3),
        speaking: Math.min(100, s.speaking + 1)
      }));
      setWeeklyData(prev => {
        const nw = [...prev];
        nw[4] = Math.min(100, nw[4] + 5);
        return nw;
      });

      // Reset the conversation back to the start
      setMessages([{ role: 'ai', content: `Hello, ${userName || 'there'}! Let's practice. Tell me about your day.` }]);
      setTranscript('');
      setSessionTime(0);
    }
  };

  const renderWaveform = () => {
    // 55 bars for the visualizer
    const bars = new Array(55).fill(0);
    return (
      <div className={styles.waveformArea}>
        {bars.map((_, i) => (
          <div 
            key={i} 
            ref={el => { waveRefs.current[i] = el; }}
            className={styles.waveBar}
          />
        ))}
      </div>
    );
  };

  const CircularProgress = ({ value }: { value: number }) => {
    const radius = 16;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (value / 100) * circumference;
    
    return (
      <div className={styles.progressValue} style={{ position: 'relative', width: 40, height: 40 }}>
        <svg width="40" height="40" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
          <circle cx="20" cy="20" r={radius} stroke="var(--bg-app)" strokeWidth="3" fill="none" />
          <circle cx="20" cy="20" r={radius} stroke="var(--primary)" strokeWidth="3" fill="none" 
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} 
            style={{ transition: 'stroke-dashoffset 1s ease-in-out' }} />
        </svg>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', zIndex: 1 }}>{value}%</span>
      </div>
    );
  };

  return (
    <div className={styles.appWindow}>
      {/* Top Navigation */}
      <nav className={styles.topNav}>
        <div className={styles.logoArea}>
          <button 
            className={styles.hamburgerBtn}
            onClick={() => setShowMobileSidebar(!showMobileSidebar)}
          >
            <div style={{width: '20px', height: '2px', background: 'white', margin: '4px 0'}}></div>
            <div style={{width: '20px', height: '2px', background: 'white', margin: '4px 0'}}></div>
            <div style={{width: '20px', height: '2px', background: 'white', margin: '4px 0'}}></div>
          </button>
          <Bot className={styles.logoIcon} />
          <span>Tuitor AI</span>
        </div>
        <div className={styles.navLinks}>
          <span className={`${styles.navLink} ${styles.active}`}>My Learning</span>
        </div>
        <div className={styles.profileArea}>
        </div>
      </nav>

      <div className={styles.contentArea}>
        {/* Left Sidebar */}
        <aside className={`${styles.sidebar} ${showMobileSidebar ? styles.open : ''}`}>
          {/* Close button for mobile sidebar */}
          <button 
            className={styles.mobileCloseSidebar} 
            onClick={() => setShowMobileSidebar(false)}
          >
            <XCircle size={24} />
          </button>
          
          <div>
            <div className={styles.sectionTitle}>My Progress</div>
            <div className={styles.progressList}>
              <div className={styles.progressItem}>
                <BookOpen className={styles.progressIcon} size={20} />
                <span className={styles.progressName}>Grammar</span>
                <CircularProgress value={stats.grammar} />
              </div>
              <div className={styles.progressItem}>
                <BookOpen className={styles.progressIcon} size={20} />
                <span className={styles.progressName}>Vocabulary</span>
                <CircularProgress value={stats.vocabulary} />
              </div>
              <div className={styles.progressItem}>
                <Volume2 className={styles.progressIcon} size={20} />
                <span className={styles.progressName}>Speaking</span>
                <CircularProgress value={stats.speaking} />
              </div>
            </div>
          </div>

          <div>
            <div className={styles.sectionTitle}>Daily Stats</div>
            {isMounted ? (
              <div className={styles.dailyStats}>
                <div className={styles.statRow}>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Grammar</span>
                    <span className={styles.statValue}>{stats.grammar}%</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Vocabulary</span>
                    <span className={styles.statValue}>{stats.vocabulary}%</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Speaking</span>
                    <span className={`${styles.statValue} ${styles.active}`}>{stats.speaking}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>Loading stats...</div>
            )}
          </div>

          <div>
            <div className={styles.sectionTitle}>Weekly Progress</div>
            {isMounted ? (
              <div className={styles.barChart}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, i) => (
                  <div key={day} className={styles.barCol}>
                    <div className={`${styles.bar} ${day === 'Fri' ? styles.active : ''}`} style={{ height: `${weeklyData[i]}%` }}></div>
                    <span className={styles.barLabel}>{day}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </aside>

        {/* Right Main Panel */}
        <main className={styles.mainPanel}>
          
          <div className={styles.speakingCard}>
            <div className={styles.speakingTitle}>Speaking Practice: Describe Your Day</div>
            
            {renderWaveform()}

            <div className={styles.speakingControls}>
              <div className={styles.controlButtons}>
                <button 
                  className={`${styles.controlBtn} ${isListening ? styles.primary : ''}`}
                  onClick={() => { if (!isListening) toggleListening(); }}
                >
                  <div style={{width: 8, height: 8, borderRadius: '50%', background: 'currentColor', opacity: isListening ? 1 : 0.5}}></div>
                  {isListening ? 'Recording' : 'Record'}
                </button>
                <button 
                  className={styles.controlBtn}
                  onClick={() => {
                    if (isListening) toggleListening();
                    stopAudio();
                  }}
                >
                  <Square size={14} /> Stop
                </button>
                <button 
                  className={styles.controlBtn}
                  onClick={() => {
                    setMessages([{ role: 'ai', content: `Hello, ${userName || 'there'}! Let's practice. Tell me about your day.` }]);
                    setTranscript('');
                    setSessionTime(0);
                    isActiveSessionRef.current = true;
                    stopAudio();
                    if (!isListening) toggleListening();
                  }}
                >
                  <RotateCcw size={14} /> Restart
                </button>
                <button 
                  className={styles.controlBtn}
                  onClick={handleEndSession}
                >
                  <XCircle size={14} /> End Session
                </button>
                <span style={{marginLeft: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem'}}>
                  {isListening ? 'Listening to you...' : isSpeaking ? 'AI Tutor is speaking...' : isProcessing ? 'Thinking...' : 'Start speaking when you\'re ready...'}
                </span>
              </div>
              <div className={styles.timer}>{formatTime(sessionTime)}</div>
            </div>
          </div>

          <div className={styles.chatArea} ref={chatAreaRef}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`${styles.chatMessage} ${styles[msg.role]}`}>
                <div className={`${styles.messageHeader} ${styles[msg.role]}`}>
                  {msg.role === 'ai' && <Bot size={16} />}
                  <span>{msg.role === 'ai' ? 'AI Tutor' : `${userName || 'You'} (Me)`}</span>
                </div>
                <div className={styles.bubble}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                {msg.correction && (
                  <div className={styles.correctionBox}>
                    <div style={{fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.3rem'}}>
                      <Sparkles size={12}/> Feedback
                    </div>
                    {msg.correction}
                  </div>
                )}
              </div>
            ))}
            {transcript && (
              <div className={`${styles.chatMessage} ${styles.user}`} style={{ opacity: 0.7 }}>
                <div className={`${styles.messageHeader} ${styles.user}`}>
                  <span>{userName || 'You'} (Me) - Speaking...</span>
                </div>
                <div className={styles.bubble}>
                  {transcript}
                </div>
              </div>
            )}
          </div>

        </main>
      </div>

      {/* Floating Action Dock */}
      <div className={styles.dock}>
        <button className={styles.dockBtn}>
          <Volume2 size={20} />
          Hold to Speak
        </button>

        <button 
          className={`${styles.micCenter} ${isListening ? styles.active : ''}`}
          onClick={toggleListening}
        >
          <Mic size={24} />
        </button>
        
        <button className={styles.dockBtn} onClick={() => setShowSettingsModal(true)}>
          <Settings size={20} />
          Settings
        </button>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <button className={styles.modalClose} onClick={() => setShowSettingsModal(false)}><X size={24} /></button>
            <h2 style={{ margin: 0 }}>Voice Settings</h2>
            
            <div className={styles.settingsGroup}>
              <label>AI Voice</label>
              <select 
                className={styles.settingsSelect}
                value={selectedVoiceURI} 
                onChange={(e) => setSelectedVoiceURI(e.target.value)}
              >
                {availableVoices.map(v => (
                  <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.settingsGroup}>
              <label>Speech Rate: {speechRate}x</label>
              <input 
                type="range" 
                min="0.5" max="1.5" step="0.1" 
                value={speechRate} 
                onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                className={styles.settingsRange}
              />
            </div>

            <div className={styles.settingsGroup} style={{ marginTop: '2rem' }}>
              <label style={{ color: 'var(--danger)' }}>Danger Zone</label>
              <button 
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: 'var(--danger)',
                  border: '1px solid var(--danger)',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
                onClick={() => {
                  if (confirm('Are you sure you want to reset all your progress?')) {
                    setStats({ grammar: 0, vocabulary: 0, speaking: 0 });
                    setWeeklyData([0, 0, 0, 0, 0]);
                    localStorage.removeItem('tuitor-stats');
                    localStorage.removeItem('tuitor-weekly');
                    setShowSettingsModal(false);
                  }
                }}
              >
                Reset All Progress
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '800px', height: '80vh' }}>
            <button className={styles.modalClose} onClick={() => setShowReportModal(false)}><X size={24} /></button>
            <h2 style={{ margin: 0, color: 'var(--primary)' }}>Session Evaluation</h2>
            <div className={styles.reportScroll}>
              <ReactMarkdown>{sessionReport || ''}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {/* Name Input Modal */}
      {showNameModal && (
        <div className={styles.modalOverlay} style={{ zIndex: 1000 }}>
          <div className={styles.modalContent} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h2 style={{ marginBottom: '1rem' }}>Welcome to Tuitor AI!</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>What should I call you?</p>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (nameInput.trim()) {
                const name = nameInput.trim();
                localStorage.setItem('tuitor-username', name);
                setUserName(name);
                setMessages([{ role: 'ai', content: `Hello, ${name}! Let's practice. Tell me about your day.` }]);
                setShowNameModal(false);
              }
            }}>
              <input 
                type="text" 
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter your name"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(0,0,0,0.2)',
                  color: 'white',
                  marginBottom: '1rem',
                  fontSize: '1rem'
                }}
                autoFocus
              />
              <button 
                type="submit"
                className={styles.controlBtn}
                style={{ width: '100%', justifyContent: 'center', background: 'var(--primary)', color: 'white', border: 'none' }}
              >
                Start Learning
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
