import React, { useRef, useState, useEffect } from 'react';
import WaterBoy3D from './components/WaterBoy3D';
import Supercar3D from './components/Supercar3D';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

export function VoiceController({ onSpeechResult }) {
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');

  const speak = (text) => {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
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

  return { speak, startListening, isListening, voiceError };
}

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [showCreateFormats, setShowCreateFormats] = useState(false);
  const promptInputRef = useRef(null);
  const [chatLog, setChatLog] = useState([]);
  const [loading, setLoading] = useState(false);
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
  const { speak, startListening, isListening, voiceError } = VoiceController({
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
      if (Array.isArray(data)) setChatLog(data);
    } catch (err) {
      console.error('Failed to load logs:', err);
    }
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate text');
      setChatLog((currentLogs) => [
        {
          id: `local-${Date.now()}`,
          user_prompt: prompt,
          ai_response: data.reply,
          action_type: 'chat',
        },
        ...currentLogs,
      ]);
      speak(data.reply);
      setPrompt('');
    } catch (err) {
      console.error('Chat request failed:', err);
    } finally {
      setLoading(false);
    }
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
        <div className="topbar-status"><span className="status-dot" /> Systems online <span className="status-divider" /> v2.4</div>
      </header>
      <main className="workspace">
        <section className="hero-panel">
          <div className="hero-copy"><p className="eyebrow">AI OPERATIONS / 01</p><h1>Turn ideas into<br /><em>momentum.</em></h1><p className="hero-description">A focused AI workspace for thinking clearly, moving quickly, and getting meaningful work out the door.</p></div>
          <Supercar3D />
        </section>
        <div className="content-grid">
          <div className="primary-column">
            <section className="composer-panel panel">
              <div className="section-heading"><div><p className="eyebrow">CONVERSATION</p><h2>What are we making today?</h2></div><div className="conversation-tools"><button type="button" className={`robot-button ${showCreateFormats ? 'is-open' : ''}`} onClick={openCreateFormats} aria-label="Open create formats" title="Open create formats"><span className="robot-antenna" /><span className="robot-eyes"><i /><i /></span><span className="robot-mouth" /></button><span className="command-hint">⌘ ↵</span></div></div>
              {showCreateFormats && <div className="create-formats"><span>CREATE FORMAT</span><button type="button" onClick={() => useCreateFormat('Write a clear plan for ')}>Plan</button><button type="button" onClick={() => useCreateFormat('Draft a professional message about ')}>Draft</button><button type="button" onClick={() => useCreateFormat('Brainstorm creative ideas for ')}>Ideas</button><button type="button" className="close-formats" onClick={() => setShowCreateFormats(false)} aria-label="Close create formats">×</button></div>}
              <form onSubmit={handleSendChat} className="composer-form">
            <input
              type="text"
              ref={promptInputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask, create, plan, or explore..."
              className="composer-input"
            />
            <button
              type="button"
              onClick={startListening}
              disabled={isListening || loading}
              aria-label={isListening ? 'Listening' : 'Use voice input'}
              title={isListening ? 'Listening...' : 'Use voice input'}
              className={`voice-button ${isListening ? 'is-listening' : ''}`}
            >
              {isListening ? '●' : '◉'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="send-button"
            >
              {loading ? 'Thinking' : 'Send'} <span>↗</span>
            </button>
          </form>
              {voiceError && <p className="form-message error-message">{voiceError}</p>}
            </section>
            <section className="thread-panel"><div className="thread-heading"><p className="eyebrow">LIVE THREAD</p><span>{chatLog.length} {chatLog.length === 1 ? 'exchange' : 'exchanges'}</span></div>{chatLog.length === 0 && <div className="empty-thread"><span className="empty-icon">✦</span><p>Your conversations will appear here.</p><small>Start with a question, a rough idea, or a task.</small></div>}<div className="thread-list">{chatLog.map((log) => <article key={log.id} className="exchange"><div className="exchange-prompt"><span className="avatar user-avatar">YOU</span><div><span className="message-label">PROMPT</span><p>{log.user_prompt}</p></div></div><div className="exchange-answer"><span className="avatar ai-avatar">T</span><div><span className="message-label answer-label">TOXIC / RESPONSE</span><p>{log.ai_response}</p></div></div></article>)}</div></section>
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
