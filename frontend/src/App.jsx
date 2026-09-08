import React, { useRef, useState, useEffect } from 'react';
import WaterBoy3D from './components/WaterBoy3D';
import Supercar3D from './components/Supercar3D';
import ChatComposer from './components/ChatComposer';
import ChatThread from './components/ChatThread';
import { cleanResponse } from './utils/cleanResponse';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

export function VoiceController({ onSpeechResult }) {
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [voiceGender, setVoiceGender] = useState(() => localStorage.getItem('toxicVoiceGender') || 'female');
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('toxicVoiceMuted') === 'true');

  const speak = (text) => {
    if (isMuted || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    const availableVoices = window.speechSynthesis.getVoices();
    const genderTerms = voiceGender === 'female' ? ['female', 'samantha', 'zira', 'victoria', 'karen'] : ['male', 'daniel', 'alex', 'david', 'tom'];
    const matchingVoice = availableVoices.find((voice) => voice.lang.startsWith('en') && genderTerms.some((term) => voice.name.toLowerCase().includes(term)));
    if (matchingVoice) utterance.voice = matchingVoice;
    window.speechSynthesis.speak(utterance);
  };

  const changeVoiceGender = (gender) => {
    setVoiceGender(gender);
    localStorage.setItem('toxicVoiceGender', gender);
  };

  const toggleMute = () => {
    setIsMuted((muted) => {
      const nextMuted = !muted;
      localStorage.setItem('toxicVoiceMuted', String(nextMuted));
      if (nextMuted) window.speechSynthesis?.cancel();
      return nextMuted;
    });
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('Speech recognition is not supported in this browser. Use Chrome or Safari.');
      return;
    }

    setVoiceError('');
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      setIsListening(false);
      setVoiceError('Microphone access failed. Check your browser permissions and try again.');
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onSpeechResult(transcript);
    };

    try {
      recognition.start();
    } catch (error) {
      setIsListening(false);
      setVoiceError('Speech recognition could not be started. Try again.');
    }
  };

  return { speak, startListening, isListening, voiceError, voiceGender, changeVoiceGender, isMuted, toggleMute };
}

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [showCreateFormats, setShowCreateFormats] = useState(false);
  const promptInputRef = useRef(null);
  const chatRequestRef = useRef(null);
  const [chatLog, setChatLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [showWaterBoy3D, setShowWaterBoy3D] = useState(false);
  const [scheduledTasks, setScheduledTasks] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('scheduledTasks') || '[]');
    } catch (error) {
      return [];
    }
  });
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDeadline, setTaskDeadline] = useState('');
  const [presentationLog, setPresentationLog] = useState([]);
  const [presentationStatus, setPresentationStatus] = useState('');
  const { speak, startListening, isListening, voiceError, voiceGender, changeVoiceGender, isMuted, toggleMute } = VoiceController({
    onSpeechResult: setPrompt,
  });

  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailStatus, setEmailStatus] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        promptInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    localStorage.setItem('scheduledTasks', JSON.stringify(scheduledTasks));
  }, [scheduledTasks]);

  const triggerWaterReminder = () => {
    const message = 'It is time to drink water and stay hydrated.';
    speak(message);
    setShowWaterBoy3D(true);
  };

  useEffect(() => {
    const currentHour = new Date().getHours();
    if (currentHour >= 6 && currentHour < 12) {
      speak('Good morning! What are your key targets and plans for today?');
    }

    const waterInterval = setInterval(() => {
      const hour = new Date().getHours();
      if (hour >= 6 && hour < 20) {
        triggerWaterReminder();
      }
    }, 7200000);

    return () => clearInterval(waterInterval);
  }, []);

  useEffect(() => {
    const checkDeadlines = async () => {
      const now = Date.now();
      const dueTasks = scheduledTasks.filter(
        (task) => task.status === 'scheduled' && new Date(task.deadline).getTime() <= now,
      );

      if (dueTasks.length === 0) return;

      setScheduledTasks((currentTasks) => currentTasks.map((task) => (
        dueTasks.some((dueTask) => dueTask.id === task.id)
          ? { ...task, status: 'processing' }
          : task
      )));

      const items = scheduledTasks.map((task) => task.title);
      await Promise.all(dueTasks.map(async (task) => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/create-presentation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: task.title, items }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to create presentation');

          setPresentationLog((currentLogs) => [
            {
              id: `presentation-${task.id}`,
              title: task.title,
              items,
              filePath: data.filePath,
              createdAt: new Date().toLocaleString(),
            },
            ...currentLogs,
          ]);
          setScheduledTasks((currentTasks) => currentTasks.map((currentTask) => (
            currentTask.id === task.id ? { ...currentTask, status: 'completed' } : currentTask
          )));
          setPresentationStatus(`Presentation created for "${task.title}".`);
        } catch (error) {
          console.error('Presentation request failed:', error);
          setScheduledTasks((currentTasks) => currentTasks.map((currentTask) => (
            currentTask.id === task.id ? { ...currentTask, status: 'failed' } : currentTask
          )));
          setPresentationStatus(`Could not create the presentation for "${task.title}".`);
        }
      }));
    };

    checkDeadlines();
    const deadlineInterval = setInterval(checkDeadlines, 1000);
    return () => clearInterval(deadlineInterval);
  }, [scheduledTasks]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/history`);
      const data = await res.json();
      if (Array.isArray(data)) setChatLog(data.map((log) => ({ ...log, ai_response: cleanResponse(log.ai_response) })));
    } catch (err) {
      console.error('Failed to load logs:', err);
    }
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    const submittedPrompt = prompt.trim();
    chatRequestRef.current?.abort();
    chatRequestRef.current = new AbortController();
    setChatError('');
    setLoading(true);
    const optimisticId = `local-${Date.now()}`;
    setChatLog((currentLogs) => [
      { id: optimisticId, user_prompt: submittedPrompt, ai_response: '', action_type: 'chat', pending: true },
      ...currentLogs,
    ]);
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: submittedPrompt }),
        signal: chatRequestRef.current.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate text');
      setChatLog((currentLogs) => currentLogs.map((log) => (
        log.id === optimisticId ? { ...log, ai_response: cleanResponse(data.reply), pending: false } : log
      )));
      speak(data.reply);
      setPrompt('');
    } catch (err) {
      setChatLog((currentLogs) => currentLogs.filter((log) => log.id !== optimisticId));
      if (err.name !== 'AbortError') setChatError(err.message || 'The assistant could not respond. Try again.');
      console.error('Chat request failed:', err);
    } finally {
      setLoading(false);
      chatRequestRef.current = null;
    }
  };

  const stopChat = () => {
    chatRequestRef.current?.abort();
    setLoading(false);
  };

  const resizePrompt = (event) => {
    const input = event.currentTarget;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
    setPrompt(input.value);
  };

  const openCreateFormats = () => {
    setShowCreateFormats(true);
    promptInputRef.current?.focus();
  };

  const useCreateFormat = (format) => {
    setPrompt(format);
    promptInputRef.current?.focus();
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    setEmailStatus('Sending...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: emailTo, subject: emailSubject, body: emailBody }),
      });
      const data = await res.json();
      if (data.success) {
        setEmailStatus('Email sent successfully!');
        setEmailTo('');
        setEmailSubject('');
        setEmailBody('');
        fetchHistory();
      } else {
        setEmailStatus('Failed to send email.');
      }
    } catch (err) {
      setEmailStatus('Error sending email.');
    }
  };

  const handleScheduleTask = (e) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskDeadline) return;

    setScheduledTasks((currentTasks) => [
      ...currentTasks,
      {
        id: `task-${Date.now()}`,
        title: taskTitle.trim(),
        deadline: new Date(taskDeadline).toISOString(),
        status: 'scheduled',
      },
    ]);
    setTaskTitle('');
    setTaskDeadline('');
  };

  return (
    <div className="app-shell">
      {showWaterBoy3D && (
        <WaterBoy3D onClose={() => setShowWaterBoy3D(false)} />
      )}
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><span /></div>
          <div><p className="brand-name">TOXIC<span> AI</span></p><p className="brand-caption">Your intelligent workbench</p></div>
        </div>
        <div className="topbar-actions"><div className="voice-dock" role="group" aria-label="Voice settings"><span className="voice-dock-label">VOICE</span><button type="button" className={voiceGender === 'female' ? 'voice-choice is-selected' : 'voice-choice'} onClick={() => changeVoiceGender('female')} aria-pressed={voiceGender === 'female'}>♀</button><button type="button" className={voiceGender === 'male' ? 'voice-choice is-selected' : 'voice-choice'} onClick={() => changeVoiceGender('male')} aria-pressed={voiceGender === 'male'}>♂</button><button type="button" className={`mute-button ${isMuted ? 'is-muted' : ''}`} onClick={toggleMute} aria-label={isMuted ? 'Unmute assistant voice' : 'Mute assistant voice'} aria-pressed={isMuted}>{isMuted ? '×' : '◖'}</button></div><div className="topbar-status"><span className="status-dot" /> Systems online <span className="status-divider" /> v2.4</div></div>
      </header>
      <main className="workspace">
        <section className="hero-panel">
          <div className="hero-copy"><p className="eyebrow">AI OPERATIONS / 01</p><h1>Turn ideas into<br /><em>momentum.</em></h1><p className="hero-description">A focused AI workspace for thinking clearly, moving quickly, and getting meaningful work out the door.</p></div>
          <Supercar3D />
        </section>
        <div className="content-grid">
          <div className="primary-column">
            <ChatComposer prompt={prompt} promptInputRef={promptInputRef} loading={loading} isListening={isListening} showCreateFormats={showCreateFormats} voiceError={voiceError} chatError={chatError} onPromptChange={resizePrompt} onSubmit={handleSendChat} onStop={stopChat} onVoice={startListening} onOpenFormats={openCreateFormats} onUseFormat={useCreateFormat} onCloseFormats={() => setShowCreateFormats(false)} />
            <ChatThread chatLog={chatLog} loading={loading} />
          </div>
          <aside className="side-column">
            <section className="tool-panel panel"><div className="section-heading compact"><div><p className="eyebrow">AUTOMATION / 02</p><h2>Send an email</h2></div><span className="tool-number">02</span></div>

          <form onSubmit={handleSendEmail} className="flex flex-col gap-3">
            <input type="email" placeholder="Recipient email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} required className="field" />
            <input type="text" placeholder="Subject" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} required className="field" />
            <textarea placeholder="Write your message..." value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows="4" required className="field textarea"></textarea>
            <button type="submit" className="action-button">Send email <span>↗</span></button>
          </form>
              {emailStatus && <p className="form-message">{emailStatus}</p>}
            </section>

            <section className="tool-panel panel"><div className="section-heading compact"><div><p className="eyebrow">PLANNING / 03</p><h2>Schedule a deliverable</h2></div><span className="tool-number">03</span></div>
          <form onSubmit={handleScheduleTask} className="flex flex-col gap-3">
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Task or deliverable"
              required
              className="field"
            />
            <input
              type="datetime-local"
              value={taskDeadline}
              onChange={(e) => setTaskDeadline(e.target.value)}
              required
              className="field"
            />
            <button type="submit" className="action-button">
              Add to schedule <span>+</span>
            </button>
          </form>
          {scheduledTasks.length > 0 && (
            <div className="mt-4 space-y-2">
              {scheduledTasks.map((task) => (
                <div key={task.id} className="task-row">
                  <span>{task.title}</span>
                  <span className={task.status === 'completed' ? 'task-complete' : task.status === 'failed' ? 'task-failed' : ''}>
                    {task.status === 'scheduled' || task.status === 'processing'
                      ? new Date(task.deadline).toLocaleString()
                      : task.status}
                  </span>
                </div>
              ))}
            </div>
          )}
              {presentationStatus && <p className="form-message">{presentationStatus}</p>}
            </section>

            <section className="activity-panel panel"><div className="section-heading compact"><div><p className="eyebrow">SYSTEM LOG</p><h2>Recent activity</h2></div><span className="pulse-icon">⌁</span></div><div className="activity-list">
          {presentationLog.map((presentation) => (
            <div key={presentation.id} className="activity-item presentation-item"><span className="activity-tag">PRESENTATION</span><p className="activity-title">{presentation.title}</p><p className="activity-meta">Generated {presentation.createdAt}</p><p className="activity-detail"><strong>Slide 2:</strong> Scheduled Deliverables</p><ul className="activity-detail list-disc pl-5">
                {presentation.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <p className="activity-meta">File: {presentation.filePath}</p>
            </div>
          ))}
          {chatLog.map((log) => (
            <div key={log.id} className="activity-item"><span className={`activity-tag ${log.action_type === 'email' ? 'email-tag' : ''}`}>
                {log.action_type.toUpperCase()}
              </span>
              <p className="activity-detail"><strong>Input:</strong> {log.user_prompt}</p><p className="activity-detail"><strong>Output:</strong> {log.ai_response}</p>
            </div>
          ))}
              </div></section>
          </aside>
        </div>
      </main>
      <footer className="footer"><span>TOXIC AI</span><span>Built for better thinking</span><span>© 2026</span></footer>
    </div>
  );
}
