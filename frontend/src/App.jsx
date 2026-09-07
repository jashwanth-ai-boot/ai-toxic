import React, { useState, useEffect } from 'react';
import WaterBoy3D from './components/WaterBoy3D';

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
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 flex flex-col md:flex-row gap-6 font-sans">
      {showWaterBoy3D && (
        <WaterBoy3D onClose={() => setShowWaterBoy3D(false)} />
      )}
      <div className="w-full md:w-1/2 flex flex-col gap-6">
        <div className="bg-slate-800 p-5 rounded-xl shadow-md border border-slate-700">
          <h2 className="text-xl font-bold mb-3 text-cyan-400">AI Assistant</h2>
          <form onSubmit={handleSendChat} className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask anything or generate text..."
              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
            />
            <button
              type="button"
              onClick={startListening}
              disabled={isListening || loading}
              aria-label={isListening ? 'Listening' : 'Use voice input'}
              title={isListening ? 'Listening...' : 'Use voice input'}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${isListening ? 'bg-rose-500 text-white' : 'bg-slate-700 text-cyan-300 hover:bg-slate-600'} disabled:cursor-not-allowed disabled:opacity-70`}
            >
              {isListening ? 'Listening...' : '🎙️'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold px-4 py-2 rounded-lg text-sm transition"
            >
              {loading ? 'Thinking...' : 'Send'}
            </button>
          </form>
          {voiceError && <p className="text-xs mt-2 text-rose-300">{voiceError}</p>}
        </div>

        <div className="bg-slate-800 p-5 rounded-xl shadow-md border border-slate-700">
          <h2 className="text-xl font-bold mb-3 text-cyan-400">Send Automated Email</h2>
          <form onSubmit={handleSendEmail} className="flex flex-col gap-3">
            <input type="email" placeholder="Recipient Email Address" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} required className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400" />
            <input type="text" placeholder="Subject" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} required className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400" />
            <textarea placeholder="Email Body Content" value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows="4" required className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"></textarea>
            <button type="submit" className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold py-2 rounded-lg text-sm transition">Send Email</button>
          </form>
          {emailStatus && <p className="text-xs mt-2 text-slate-300">{emailStatus}</p>}
        </div>

        <div className="bg-slate-800 p-5 rounded-xl shadow-md border border-slate-700">
          <h2 className="text-xl font-bold mb-3 text-cyan-400">Schedule Presentation</h2>
          <form onSubmit={handleScheduleTask} className="flex flex-col gap-3">
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Task or deliverable"
              required
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
            />
            <input
              type="datetime-local"
              value={taskDeadline}
              onChange={(e) => setTaskDeadline(e.target.value)}
              required
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
            />
            <button type="submit" className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold py-2 rounded-lg text-sm transition">
              Schedule Task
            </button>
          </form>
          {scheduledTasks.length > 0 && (
            <div className="mt-4 space-y-2">
              {scheduledTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-700/50 px-3 py-2 text-xs">
                  <span className="text-slate-200">{task.title}</span>
                  <span className={`${task.status === 'completed' ? 'text-emerald-300' : task.status === 'failed' ? 'text-rose-300' : 'text-slate-400'}`}>
                    {task.status === 'scheduled' || task.status === 'processing'
                      ? new Date(task.deadline).toLocaleString()
                      : task.status}
                  </span>
                </div>
              ))}
            </div>
          )}
          {presentationStatus && <p className="text-xs mt-2 text-slate-300">{presentationStatus}</p>}
        </div>
      </div>

      <div className="w-full md:w-1/2 bg-slate-800 p-5 rounded-xl shadow-md border border-slate-700">
        <h2 className="text-xl font-bold mb-3 text-cyan-400">Activity Log</h2>
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
          {presentationLog.map((presentation) => (
            <div key={presentation.id} className="bg-cyan-950/40 p-3 rounded-lg border border-cyan-700/60">
              <span className="text-xs px-2 py-0.5 rounded font-mono bg-cyan-500/20 text-cyan-300">PRESENTATION</span>
              <p className="text-sm text-cyan-100 mt-2 font-semibold">{presentation.title}</p>
              <p className="text-xs text-slate-400 mt-1">Generated {presentation.createdAt}</p>
              <p className="text-xs text-slate-200 mt-2"><strong>Slide 2:</strong> Scheduled Deliverables</p>
              <ul className="mt-1 list-disc pl-5 text-xs text-slate-300">
                {presentation.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <p className="text-xs text-slate-500 mt-2">File: {presentation.filePath}</p>
            </div>
          ))}
          {chatLog.map((log) => (
            <div key={log.id} className="bg-slate-700/50 p-3 rounded-lg border border-slate-600">
              <span className={`text-xs px-2 py-0.5 rounded font-mono ${log.action_type === 'email' ? 'bg-amber-500/20 text-amber-300' : 'bg-cyan-500/20 text-cyan-300'}`}>
                {log.action_type.toUpperCase()}
              </span>
              <p className="text-xs text-slate-400 mt-2"><strong>Input:</strong> {log.user_prompt}</p>
              <p className="text-xs text-slate-200 mt-1"><strong>Output:</strong> {log.ai_response}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
