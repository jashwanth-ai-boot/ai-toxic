import React from 'react';

export default function ChatThread({ chatLog, loading }) {
  return (
    <section className="thread-panel" aria-live="polite" aria-busy={loading}>
      <div className="thread-heading"><p className="eyebrow">LIVE THREAD</p><span>{chatLog.length} {chatLog.length === 1 ? 'exchange' : 'exchanges'}</span></div>
      {chatLog.length === 0 && !loading && <div className="empty-thread"><span className="empty-icon">✦</span><p>Your conversations will appear here.</p><small>Start with a question, a rough idea, or a task.</small></div>}
      {loading && <div className="response-skeleton" aria-label="Toxic AI is thinking"><span className="avatar ai-avatar">T</span><div className="skeleton-lines"><i /><i /><i /></div></div>}
      <div className="thread-list">
        {chatLog.map((log) => (
          <article key={log.id} className="exchange">
            <div className="exchange-prompt"><span className="avatar user-avatar">YOU</span><div><span className="message-label">PROMPT</span><p>{log.user_prompt}</p></div></div>
            <div className="exchange-answer"><span className="avatar ai-avatar">T</span><div><span className="message-label answer-label">TOXIC / RESPONSE</span>{log.pending ? <div className="inline-pending"><i /><i /><i /></div> : <><p>{log.ai_response}</p><span className="response-cursor" aria-hidden="true" /></>}</div></div>
          </article>
        ))}
      </div>
    </section>
  );
}
